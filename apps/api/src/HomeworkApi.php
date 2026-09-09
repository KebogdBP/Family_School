<?php

declare(strict_types=1);

namespace HomeEdu;

use PDO;

final class HomeworkApi
{
    public static function dispatch(PDO $db,string $method,string $path): never
    {
        if(str_starts_with($path,'/api/v1/student/homeworks/')){
            $session=Auth::requireRole($db,'student');
            if($method==='PUT'&&preg_match('#^/api/v1/student/homeworks/([0-9a-f-]{36})/submission$#',$path,$m)===1) self::saveSubmission($db,(string)$session['family_id'],(string)$session['student_id'],$m[1]);
            if($method==='POST'&&preg_match('#^/api/v1/student/homeworks/([0-9a-f-]{36})/files$#',$path,$m)===1) self::uploadFile($db,(string)$session['family_id'],(string)$session['student_id'],$m[1]);
            Http::error('not_found','Маршрут не найден',404);
        }
        if(preg_match('#^/api/v1/submission-files/([0-9a-f-]{36})$#',$path,$m)===1){$session=Auth::requireSession($db);if($method==='GET')self::downloadFile($db,$session,$m[1]);if($method==='DELETE')self::deleteFile($db,$session,$m[1]);Http::error('not_found','Маршрут не найден',404);}
        $session=Auth::requireRole($db,'parent');$familyId=(string)$session['family_id'];$actorId=(string)$session['user_id'];
        match(true){
            $method==='GET'&&preg_match('#^/api/v1/lessons/([0-9a-f-]{36})/homeworks$#',$path,$m)===1=>self::listHomeworks($db,$familyId,$m[1]),
            $method==='POST'&&preg_match('#^/api/v1/lessons/([0-9a-f-]{36})/homeworks$#',$path,$m)===1=>self::createHomework($db,$familyId,$actorId,$m[1]),
            $method==='DELETE'&&preg_match('#^/api/v1/homeworks/([0-9a-f-]{36})$#',$path,$m)===1=>self::deleteHomework($db,$familyId,$actorId,$m[1]),
            $method==='GET'&&$path==='/api/v1/review-submissions'=>self::reviewQueue($db,$familyId),
            $method==='POST'&&preg_match('#^/api/v1/submissions/([0-9a-f-]{36})/reviews$#',$path,$m)===1=>self::review($db,$familyId,$actorId,$m[1]),
            default=>Http::error('not_found','Маршрут не найден',404),
        };
    }

    private static function listHomeworks(PDO $db,string $familyId,string $lessonId): never { self::lesson($db,$familyId,$lessonId);$s=$db->prepare('SELECT id,title,instructions,position FROM activities WHERE lesson_id=:lesson_id AND family_id=:family_id AND activity_type=\'open_work\' AND deleted_at IS NULL ORDER BY position,created_at');$s->execute(['lesson_id'=>$lessonId,'family_id'=>$familyId]);Http::json(['homeworks'=>array_map(static fn(array $r):array=>['id'=>$r['id'],'title'=>$r['title'],'instructions'=>$r['instructions'],'position'=>(int)$r['position']],$s->fetchAll())]); }
    private static function createHomework(PDO $db,string $familyId,string $actorId,string $lessonId): never { self::lesson($db,$familyId,$lessonId);$b=Http::body();$title=trim((string)($b['title']??''));$instructions=trim((string)($b['instructions']??''));if($title===''||$instructions==='')Http::error('validation_error','Заполните название и условие задания',422);$id=Uuid::v4();$db->prepare('INSERT INTO activities(id,family_id,lesson_id,activity_type,title,instructions,position)VALUES(:id,:family_id,:lesson_id,\'open_work\',:title,:instructions,:position)')->execute(['id'=>$id,'family_id'=>$familyId,'lesson_id'=>$lessonId,'title'=>$title,'instructions'=>$instructions,'position'=>max(0,(int)($b['position']??0))]);Audit::record($db,$familyId,'parent',$actorId,'homework.created','activity',$id);Http::json(['homework'=>['id'=>$id]],201); }
    private static function deleteHomework(PDO $db,string $familyId,string $actorId,string $id): never { $s=$db->prepare('UPDATE activities SET deleted_at=NOW() WHERE id=:id AND family_id=:family_id AND activity_type=\'open_work\' AND deleted_at IS NULL');$s->execute(['id'=>$id,'family_id'=>$familyId]);if($s->rowCount()===0)Http::error('not_found','Задание не найдено',404);Audit::record($db,$familyId,'parent',$actorId,'homework.deleted','activity',$id);Http::json(['status'=>'ok']); }

    private static function saveSubmission(PDO $db,string $familyId,string $studentId,string $activityId): never
    {
        self::studentActivity($db,$familyId,$studentId,$activityId);
        $existing=$db->prepare('SELECT status FROM homework_submissions WHERE student_id=:student_id AND activity_id=:activity_id');$existing->execute(['student_id'=>$studentId,'activity_id'=>$activityId]);$existingStatus=$existing->fetchColumn();
        if(in_array($existingStatus,['submitted','reviewed'],true))Http::error('submission_locked','Работа уже отправлена и недоступна для изменения',409);
        $b=Http::body();$text=trim((string)($b['responseText']??''));$submit=($b['submit']??false)===true;if($text===''||mb_strlen($text)>20000)Http::error('validation_error','Ответ обязателен и не длиннее 20000 символов',422);$id=Uuid::v4();$status=$submit?'submitted':'draft';
        $db->prepare('INSERT INTO homework_submissions(id,family_id,student_id,activity_id,response_text,status,submitted_at)VALUES(:id,:family_id,:student_id,:activity_id,:text,:status,:submitted_at) ON DUPLICATE KEY UPDATE response_text=VALUES(response_text),status=VALUES(status),submitted_at=VALUES(submitted_at),updated_at=NOW()')->execute(['id'=>$id,'family_id'=>$familyId,'student_id'=>$studentId,'activity_id'=>$activityId,'text'=>$text,'status'=>$status,'submitted_at'=>$submit?date('Y-m-d H:i:s'):null]);
        $s=$db->prepare('SELECT id FROM homework_submissions WHERE student_id=:student_id AND activity_id=:activity_id');$s->execute(['student_id'=>$studentId,'activity_id'=>$activityId]);$id=(string)$s->fetchColumn();Audit::record($db,$familyId,'student',$studentId,$submit?'homework.submitted':'homework.draft_saved','submission',$id);Http::json(['submission'=>['id'=>$id,'status'=>$status,'responseText'=>$text]]);
    }

    private static function reviewQueue(PDO $db,string $familyId): never
    {
        $s=$db->prepare('SELECT hs.id,hs.response_text,hs.status,hs.submitted_at,st.display_name,a.title,a.instructions,l.title AS lesson_title,su.title AS subject_title,su.color AS subject_color FROM homework_submissions hs JOIN students st ON st.id=hs.student_id JOIN activities a ON a.id=hs.activity_id JOIN lessons l ON l.id=a.lesson_id JOIN topics t ON t.id=l.topic_id JOIN sections se ON se.id=t.section_id JOIN curriculum_subjects cs ON cs.id=se.curriculum_subject_id JOIN subjects su ON su.id=cs.subject_id WHERE hs.family_id=:family_id AND hs.status<>\'draft\' ORDER BY hs.submitted_at DESC');$s->execute(['family_id'=>$familyId]);$items=array_map(static fn(array $r):array=>['id'=>$r['id'],'studentName'=>$r['display_name'],'title'=>$r['title'],'instructions'=>$r['instructions'],'lessonTitle'=>$r['lesson_title'],'subjectTitle'=>$r['subject_title'],'subjectColor'=>$r['subject_color'],'responseText'=>$r['response_text'],'status'=>$r['status'],'submittedAt'=>$r['submitted_at'],'files'=>[]],$s->fetchAll());foreach($items as &$item){$files=$db->prepare('SELECT id,original_name,mime_type,size_bytes FROM submission_files WHERE submission_id=:submission_id ORDER BY created_at');$files->execute(['submission_id'=>$item['id']]);$item['files']=array_map(static fn(array $f):array=>['id'=>$f['id'],'originalName'=>$f['original_name'],'mimeType'=>$f['mime_type'],'sizeBytes'=>(int)$f['size_bytes'],'url'=>'/api/v1/submission-files/'.$f['id']],$files->fetchAll());}unset($item);Http::json(['submissions'=>$items]);
    }

    private static function review(PDO $db,string $familyId,string $actorId,string $submissionId): never
    {
        $b=Http::body();$decision=(string)($b['decision']??'');$comment=trim((string)($b['comment']??''));$grade=isset($b['grade'])?(int)$b['grade']:null;
        if(!in_array($decision,['accepted','needs_revision'],true)||$comment===''||($grade!==null&&($grade<2||$grade>5)))Http::error('validation_error','Проверьте решение, оценку и комментарий',422);
        $s=$db->prepare('SELECT hs.id,hs.student_id,t.id AS topic_id,(SELECT COUNT(*) FROM submission_reviews sr WHERE sr.submission_id=hs.id AND sr.decision=\'needs_revision\') AS revision_count FROM homework_submissions hs JOIN activities a ON a.id=hs.activity_id JOIN lessons l ON l.id=a.lesson_id JOIN topics t ON t.id=l.topic_id WHERE hs.id=:id AND hs.family_id=:family_id AND hs.status IN(\'submitted\',\'needs_revision\')');$s->execute(['id'=>$submissionId,'family_id'=>$familyId]);$submission=$s->fetch();if(!$submission)Http::error('not_found','Работа для проверки не найдена',404);
        $reviewId=Uuid::v4();$db->beginTransaction();
        try{
            $db->prepare('INSERT INTO submission_reviews(id,family_id,submission_id,reviewer_id,decision,grade,comment)VALUES(:id,:family_id,:submission_id,:reviewer_id,:decision,:grade,:comment)')->execute(['id'=>$reviewId,'family_id'=>$familyId,'submission_id'=>$submissionId,'reviewer_id'=>$actorId,'decision'=>$decision,'grade'=>$grade,'comment'=>$comment]);
            $db->prepare('UPDATE homework_submissions SET status=:status WHERE id=:id')->execute(['status'=>$decision==='accepted'?'reviewed':'needs_revision','id'=>$submissionId]);
            Mastery::record($db,$familyId,(string)$submission['student_id'],(string)$submission['topic_id'],'homework',$reviewId,$decision==='accepted',$grade===null?null:$grade*20,$decision==='accepted'?'Домашняя работа принята родителем.':'Домашняя работа возвращена на доработку.');
            if($decision==='accepted'&&(int)$submission['revision_count']>0)Achievements::award($db,$familyId,(string)$submission['student_id'],'independent_revision','Самостоятельная доработка','Ты учёл комментарий, исправил работу и успешно отправил её снова.',$submissionId);
            Audit::record($db,$familyId,'parent',$actorId,'homework.reviewed','submission',$submissionId,['decision'=>$decision,'grade'=>$grade]);$db->commit();
        }catch(\Throwable $e){$db->rollBack();throw $e;}
        Http::json(['review'=>['id'=>$reviewId,'decision'=>$decision,'grade'=>$grade,'comment'=>$comment]]);
    }

    private static function uploadFile(PDO $db,string $familyId,string $studentId,string $activityId): never
    {
        self::studentActivity($db,$familyId,$studentId,$activityId);$submission=$db->prepare('SELECT id,status FROM homework_submissions WHERE student_id=:student_id AND activity_id=:activity_id');$submission->execute(['student_id'=>$studentId,'activity_id'=>$activityId]);$row=$submission->fetch();if(!$row)Http::error('draft_required','Сначала сохраните текстовый черновик',409);if(in_array($row['status'],['submitted','reviewed'],true))Http::error('submission_locked','Работа уже отправлена',409);
        $file=$_FILES['file']??null;if(!is_array($file)||($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK)Http::error('upload_error','Не удалось получить файл',422);$size=(int)($file['size']??0);$max=10*1024*1024;if($size<1||$size>$max)Http::error('file_too_large','Файл должен быть не больше 10 МБ',422);
        $tmp=(string)$file['tmp_name'];$mime=(new \finfo(FILEINFO_MIME_TYPE))->file($tmp);$allowed=['image/jpeg'=>'jpg','image/png'=>'png','application/pdf'=>'pdf'];if(!is_string($mime)||!isset($allowed[$mime]))Http::error('invalid_file_type','Разрешены JPG, PNG и PDF',422);$id=Uuid::v4();$storageName=$id.'.'.$allowed[$mime];$directory=dirname(__DIR__).'/storage/uploads';if(!is_dir($directory)&&!mkdir($directory,0700,true)&&!is_dir($directory))throw new \RuntimeException('Не удалось создать каталог загрузок');$target=$directory.'/'.$storageName;if(!move_uploaded_file($tmp,$target))throw new \RuntimeException('Не удалось сохранить файл');chmod($target,0600);$original=mb_substr(basename((string)($file['name']??'file')),0,255);
        try{$db->prepare('INSERT INTO submission_files(id,family_id,submission_id,original_name,storage_name,mime_type,size_bytes)VALUES(:id,:family_id,:submission_id,:original,:storage,:mime,:size)')->execute(['id'=>$id,'family_id'=>$familyId,'submission_id'=>$row['id'],'original'=>$original,'storage'=>$storageName,'mime'=>$mime,'size'=>$size]);}catch(\Throwable $e){unlink($target);throw $e;}Audit::record($db,$familyId,'student',$studentId,'homework.file_uploaded','submission_file',$id);Http::json(['file'=>['id'=>$id,'originalName'=>$original,'mimeType'=>$mime,'sizeBytes'=>$size,'url'=>'/api/v1/submission-files/'.$id]],201);
    }

    /** @param array<string,mixed> $session */
    private static function fileRecord(PDO $db,array $session,string $id): array
    {
        $sql='SELECT sf.*,hs.student_id,hs.status FROM submission_files sf JOIN homework_submissions hs ON hs.id=sf.submission_id WHERE sf.id=:id AND sf.family_id=:family_id';$params=['id'=>$id,'family_id'=>$session['family_id']];if($session['role']==='student'){$sql.=' AND hs.student_id=:student_id';$params['student_id']=$session['student_id'];}$s=$db->prepare($sql);$s->execute($params);$row=$s->fetch();if(!$row)Http::error('not_found','Файл не найден',404);return $row;
    }

    /** @param array<string,mixed> $session */
    private static function downloadFile(PDO $db,array $session,string $id): never
    {
        $row=self::fileRecord($db,$session,$id);$path=dirname(__DIR__).'/storage/uploads/'.$row['storage_name'];if(!is_file($path))Http::error('not_found','Файл отсутствует в хранилище',404);header('Content-Type: '.$row['mime_type']);header('Content-Length: '.(string)filesize($path));header('Content-Disposition: inline; filename*=UTF-8\'\''.rawurlencode((string)$row['original_name']));header('X-Content-Type-Options: nosniff');header('Cache-Control: private, no-store');readfile($path);exit;
    }

    /** @param array<string,mixed> $session */
    private static function deleteFile(PDO $db,array $session,string $id): never
    {
        if($session['role']!=='student')Http::error('forbidden','Удалять вложение может только ученик',403);$row=self::fileRecord($db,$session,$id);if(in_array($row['status'],['submitted','reviewed'],true))Http::error('submission_locked','Работа уже отправлена',409);$db->prepare('DELETE FROM submission_files WHERE id=:id')->execute(['id'=>$id]);$path=dirname(__DIR__).'/storage/uploads/'.$row['storage_name'];if(is_file($path))unlink($path);Audit::record($db,(string)$session['family_id'],'student',(string)$session['student_id'],'homework.file_deleted','submission_file',$id);Http::json(['status'=>'ok']);
    }

    private static function lesson(PDO $db,string $familyId,string $id): void{$s=$db->prepare('SELECT id FROM lessons WHERE id=:id AND family_id=:family_id AND deleted_at IS NULL');$s->execute(['id'=>$id,'family_id'=>$familyId]);if(!$s->fetchColumn())Http::error('not_found','Урок не найден',404);}
    private static function studentActivity(PDO $db,string $familyId,string $studentId,string $id): void{$s=$db->prepare('SELECT a.id FROM activities a JOIN lessons l ON l.id=a.lesson_id JOIN topics t ON t.id=l.topic_id JOIN sections se ON se.id=t.section_id JOIN curriculum_subjects cs ON cs.id=se.curriculum_subject_id JOIN curricula c ON c.id=cs.curriculum_id WHERE a.id=:id AND a.family_id=:family_id AND c.student_id=:student_id AND a.activity_type=\'open_work\' AND a.deleted_at IS NULL');$s->execute(['id'=>$id,'family_id'=>$familyId,'student_id'=>$studentId]);if(!$s->fetchColumn())Http::error('not_found','Задание не найдено в вашей программе',404);}
}
