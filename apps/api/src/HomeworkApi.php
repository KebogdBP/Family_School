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
            Http::error('not_found','Маршрут не найден',404);
        }
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
        $s=$db->prepare('SELECT hs.id,hs.response_text,hs.status,hs.submitted_at,st.display_name,a.title,a.instructions,l.title AS lesson_title,su.title AS subject_title,su.color AS subject_color FROM homework_submissions hs JOIN students st ON st.id=hs.student_id JOIN activities a ON a.id=hs.activity_id JOIN lessons l ON l.id=a.lesson_id JOIN topics t ON t.id=l.topic_id JOIN sections se ON se.id=t.section_id JOIN curriculum_subjects cs ON cs.id=se.curriculum_subject_id JOIN subjects su ON su.id=cs.subject_id WHERE hs.family_id=:family_id AND hs.status<>\'draft\' ORDER BY hs.submitted_at DESC');$s->execute(['family_id'=>$familyId]);$items=array_map(static fn(array $r):array=>['id'=>$r['id'],'studentName'=>$r['display_name'],'title'=>$r['title'],'instructions'=>$r['instructions'],'lessonTitle'=>$r['lesson_title'],'subjectTitle'=>$r['subject_title'],'subjectColor'=>$r['subject_color'],'responseText'=>$r['response_text'],'status'=>$r['status'],'submittedAt'=>$r['submitted_at']],$s->fetchAll());Http::json(['submissions'=>$items]);
    }

    private static function review(PDO $db,string $familyId,string $actorId,string $submissionId): never
    {
        $b=Http::body();$decision=(string)($b['decision']??'');$comment=trim((string)($b['comment']??''));$grade=isset($b['grade'])?(int)$b['grade']:null;if(!in_array($decision,['accepted','needs_revision'],true)||$comment===''||($grade!==null&&($grade<2||$grade>5)))Http::error('validation_error','Проверьте решение, оценку и комментарий',422);$s=$db->prepare('SELECT id FROM homework_submissions WHERE id=:id AND family_id=:family_id AND status IN(\'submitted\',\'needs_revision\')');$s->execute(['id'=>$submissionId,'family_id'=>$familyId]);if(!$s->fetchColumn())Http::error('not_found','Работа для проверки не найдена',404);$reviewId=Uuid::v4();$db->beginTransaction();try{$db->prepare('INSERT INTO submission_reviews(id,family_id,submission_id,reviewer_id,decision,grade,comment)VALUES(:id,:family_id,:submission_id,:reviewer_id,:decision,:grade,:comment)')->execute(['id'=>$reviewId,'family_id'=>$familyId,'submission_id'=>$submissionId,'reviewer_id'=>$actorId,'decision'=>$decision,'grade'=>$grade,'comment'=>$comment]);$db->prepare('UPDATE homework_submissions SET status=:status WHERE id=:id')->execute(['status'=>$decision==='accepted'?'reviewed':'needs_revision','id'=>$submissionId]);Audit::record($db,$familyId,'parent',$actorId,'homework.reviewed','submission',$submissionId,['decision'=>$decision,'grade'=>$grade]);$db->commit();}catch(\Throwable $e){$db->rollBack();throw $e;}Http::json(['review'=>['id'=>$reviewId,'decision'=>$decision,'grade'=>$grade,'comment'=>$comment]]);
    }

    private static function lesson(PDO $db,string $familyId,string $id): void{$s=$db->prepare('SELECT id FROM lessons WHERE id=:id AND family_id=:family_id AND deleted_at IS NULL');$s->execute(['id'=>$id,'family_id'=>$familyId]);if(!$s->fetchColumn())Http::error('not_found','Урок не найден',404);}
    private static function studentActivity(PDO $db,string $familyId,string $studentId,string $id): void{$s=$db->prepare('SELECT a.id FROM activities a JOIN lessons l ON l.id=a.lesson_id JOIN topics t ON t.id=l.topic_id JOIN sections se ON se.id=t.section_id JOIN curriculum_subjects cs ON cs.id=se.curriculum_subject_id JOIN curricula c ON c.id=cs.curriculum_id WHERE a.id=:id AND a.family_id=:family_id AND c.student_id=:student_id AND a.activity_type=\'open_work\' AND a.deleted_at IS NULL');$s->execute(['id'=>$id,'family_id'=>$familyId,'student_id'=>$studentId]);if(!$s->fetchColumn())Http::error('not_found','Задание не найдено в вашей программе',404);}
}
