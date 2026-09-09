<?php

declare(strict_types=1);

namespace HomeEdu;

use PDO;

final class ReviewApi
{
    public static function dispatch(PDO $db,string $method,string $path): never
    {
        $session=Auth::requireRole($db,'student');$familyId=(string)$session['family_id'];$studentId=(string)$session['student_id'];
        if(preg_match('#^/api/v1/student/reviews/([0-9a-f-]{36})$#',$path,$m)!==1)Http::error('not_found','Маршрут не найден',404);
        if($method==='GET')self::task($db,$familyId,$studentId,$m[1],false);
        if($method==='POST')self::submit($db,$familyId,$studentId,$m[1]);
        Http::error('not_found','Маршрут не найден',404);
    }

    private static function submit(PDO $db,string $familyId,string $studentId,string $scheduleId): never
    {
        [$task,$questions]=self::load($db,$familyId,$studentId,$scheduleId,true);$body=Http::body();$submitted=$body['answers']??null;
        if(!is_array($submitted))Http::error('validation_error','Ответьте на все вопросы',422);$byId=[];foreach($submitted as $answer){if(is_array($answer)&&isset($answer['questionId']))$byId[(string)$answer['questionId']]=$answer;}
        $results=[];$correctCount=0;foreach($questions as $question){$input=$byId[$question['id']]??null;if(!is_array($input))Http::error('validation_error','Ответьте на все вопросы',422);$expected=json_decode((string)$question['correct_answer_json'],true,flags:JSON_THROW_ON_ERROR);[$answer,$correct]=QuizApi::evaluate((string)$question['question_type'],$input,$expected);$correctCount+=$correct?1:0;$results[]=['questionId'=>$question['id'],'answer'=>$answer,'correct'=>$correct,'explanation'=>$question['explanation']];}
        $score=(int)round($correctCount/count($questions)*100);$successful=$score>=80;$attemptId=Uuid::v4();$db->beginTransaction();
        try{$db->prepare('INSERT INTO review_attempts(id,family_id,student_id,review_schedule_id,score,is_successful) VALUES(:id,:family_id,:student_id,:schedule_id,:score,:successful)')->execute(['id'=>$attemptId,'family_id'=>$familyId,'student_id'=>$studentId,'schedule_id'=>$scheduleId,'score'=>$score,'successful'=>$successful?1:0]);foreach($results as $result)$db->prepare('INSERT INTO review_attempt_answers(id,review_attempt_id,question_id,answer_json,is_correct) VALUES(:id,:attempt_id,:question_id,:answer,:correct)')->execute(['id'=>Uuid::v4(),'attempt_id'=>$attemptId,'question_id'=>$result['questionId'],'answer'=>json_encode($result['answer'],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'correct'=>$result['correct']?1:0]);Mastery::record($db,$familyId,$studentId,(string)$task['topic_id'],'review',$attemptId,$successful,$score,$successful?'Контрольное повторение выполнено успешно.':'Контрольное повторение пока не пройдено.');Audit::record($db,$familyId,'student',$studentId,'review.attempted','review_schedule',$scheduleId,['score'=>$score]);$db->commit();}catch(\Throwable $e){$db->rollBack();throw $e;}
        Http::json(['attempt'=>['id'=>$attemptId,'score'=>$score,'successful'=>$successful,'results'=>array_map(static fn(array $r):array=>['questionId'=>$r['questionId'],'correct'=>$r['correct'],'explanation'=>$r['explanation']],$results)]]);
    }

    private static function task(PDO $db,string $familyId,string $studentId,string $scheduleId,bool $requireDue): never
    {
        [$task,$questions]=self::load($db,$familyId,$studentId,$scheduleId,$requireDue);Http::json(['review'=>['id'=>$task['id'],'topicTitle'=>$task['topic_title'],'subjectTitle'=>$task['subject_title'],'subjectColor'=>$task['subject_color'],'dueDate'=>$task['due_date'],'questions'=>array_map(static fn(array $q):array=>['id'=>$q['id'],'prompt'=>$q['prompt'],'questionType'=>$q['question_type'],'options'=>$q['options_json']?json_decode((string)$q['options_json'],true,flags:JSON_THROW_ON_ERROR):[]],$questions)]]);
    }

    /** @return array{0:array<string,mixed>,1:array<int,array<string,mixed>>} */
    private static function load(PDO $db,string $familyId,string $studentId,string $scheduleId,bool $requireDue): array
    {
        $s=$db->prepare('SELECT rs.id,rs.topic_id,rs.due_date,t.title AS topic_title,su.title AS subject_title,su.color AS subject_color FROM review_schedule rs JOIN topics t ON t.id=rs.topic_id JOIN sections se ON se.id=t.section_id JOIN curriculum_subjects cs ON cs.id=se.curriculum_subject_id JOIN curricula c ON c.id=cs.curriculum_id JOIN subjects su ON su.id=cs.subject_id WHERE rs.id=:id AND rs.family_id=:family_id AND rs.student_id=:student_id AND c.student_id=:curriculum_student AND rs.status=\'pending\' LIMIT 1');$s->execute(['id'=>$scheduleId,'family_id'=>$familyId,'student_id'=>$studentId,'curriculum_student'=>$studentId]);$task=$s->fetch();if(!$task)Http::error('not_found','Повторение не найдено',404);if($requireDue&&$task['due_date']>date('Y-m-d'))Http::error('review_not_due','Контрольная ещё не назначена на сегодня',409);
        $q=$db->prepare('SELECT q.id,q.prompt,q.question_type,q.options_json,q.correct_answer_json,q.explanation FROM activities a JOIN quiz_questions q ON q.activity_id=a.id JOIN lessons l ON l.id=a.lesson_id WHERE l.topic_id=:topic_id AND a.activity_type=\'quiz\' AND a.deleted_at IS NULL AND l.deleted_at IS NULL ORDER BY a.position,a.created_at LIMIT 3');$q->execute(['topic_id'=>$task['topic_id']]);$questions=$q->fetchAll();if($questions===[])Http::error('review_unavailable','Для темы пока нет тестовых вопросов',409);return[$task,$questions];
    }
}
