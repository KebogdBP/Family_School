<?php

declare(strict_types=1);

namespace HomeEdu;

use PDO;

final class QuizApi
{
    public static function dispatch(PDO $db, string $method, string $path): never
    {
        if (str_starts_with($path, '/api/v1/student/quizzes/')) {
            $session = Auth::requireRole($db, 'student');
            if ($method === 'POST' && preg_match('#^/api/v1/student/quizzes/([0-9a-f-]{36})/attempts$#', $path, $m) === 1) {
                self::attempt($db, (string) $session['family_id'], (string) $session['student_id'], $m[1]);
            }
            Http::error('not_found', 'Маршрут не найден', 404);
        }

        $session = Auth::requireRole($db, 'parent');
        $familyId = (string) $session['family_id'];
        $actorId = (string) $session['user_id'];
        match (true) {
            $method === 'GET' && preg_match('#^/api/v1/lessons/([0-9a-f-]{36})/quizzes$#', $path, $m) === 1
                => self::list($db, $familyId, $m[1]),
            $method === 'POST' && preg_match('#^/api/v1/lessons/([0-9a-f-]{36})/quizzes$#', $path, $m) === 1
                => self::create($db, $familyId, $actorId, $m[1]),
            $method === 'DELETE' && preg_match('#^/api/v1/quizzes/([0-9a-f-]{36})$#', $path, $m) === 1
                => self::delete($db, $familyId, $actorId, $m[1]),
            default => Http::error('not_found', 'Маршрут не найден', 404),
        };
    }

    private static function list(PDO $db, string $familyId, string $lessonId): never
    {
        self::parentLesson($db, $familyId, $lessonId);
        $statement = $db->prepare('SELECT a.id,a.title,a.instructions,q.id AS question_id,q.prompt,q.options_json,q.correct_option,q.explanation FROM activities a JOIN quiz_questions q ON q.activity_id=a.id WHERE a.lesson_id=:lesson_id AND a.family_id=:family_id AND a.activity_type=\'quiz\' AND a.deleted_at IS NULL ORDER BY a.position,a.created_at');
        $statement->execute(['lesson_id' => $lessonId, 'family_id' => $familyId]);
        Http::json(['quizzes' => array_map([self::class, 'parentQuiz'], $statement->fetchAll())]);
    }

    private static function create(PDO $db, string $familyId, string $actorId, string $lessonId): never
    {
        self::parentLesson($db, $familyId, $lessonId);
        $body = Http::body();
        $title = trim((string) ($body['title'] ?? 'Мини-тест'));
        $prompt = trim((string) ($body['prompt'] ?? ''));
        $options = $body['options'] ?? null;
        $correct = (int) ($body['correctOption'] ?? -1);
        $explanation = trim((string) ($body['explanation'] ?? ''));
        if ($title === '' || $prompt === '' || !is_array($options) || count($options) < 2 || count($options) > 6) Http::error('validation_error', 'Добавьте вопрос и от 2 до 6 вариантов', 422);
        $options = array_map(static fn (mixed $value): string => trim((string) $value), array_values($options));
        if (in_array('', $options, true) || $correct < 0 || $correct >= count($options)) Http::error('validation_error', 'Проверьте варианты и правильный ответ', 422);
        $activityId = Uuid::v4();
        $questionId = Uuid::v4();
        $db->beginTransaction();
        try {
            $db->prepare('INSERT INTO activities (id,family_id,lesson_id,activity_type,title,instructions,position) VALUES (:id,:family_id,:lesson_id,\'quiz\',:title,:instructions,:position)')->execute(['id'=>$activityId,'family_id'=>$familyId,'lesson_id'=>$lessonId,'title'=>$title,'instructions'=>null,'position'=>max(0,(int)($body['position']??0))]);
            $db->prepare('INSERT INTO quiz_questions (id,family_id,activity_id,prompt,options_json,correct_option,explanation) VALUES (:id,:family_id,:activity_id,:prompt,:options,:correct,:explanation)')->execute(['id'=>$questionId,'family_id'=>$familyId,'activity_id'=>$activityId,'prompt'=>$prompt,'options'=>json_encode($options, JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'correct'=>$correct,'explanation'=>$explanation===''?null:$explanation]);
            Audit::record($db,$familyId,'parent',$actorId,'quiz.created','activity',$activityId);
            $db->commit();
        } catch (\Throwable $error) { $db->rollBack(); throw $error; }
        Http::json(['quiz'=>['id'=>$activityId]],201);
    }

    private static function delete(PDO $db, string $familyId, string $actorId, string $id): never
    {
        $statement=$db->prepare('UPDATE activities SET deleted_at=NOW() WHERE id=:id AND family_id=:family_id AND activity_type=\'quiz\' AND deleted_at IS NULL');
        $statement->execute(['id'=>$id,'family_id'=>$familyId]);
        if ($statement->rowCount()===0) Http::error('not_found','Тест не найден',404);
        Audit::record($db,$familyId,'parent',$actorId,'quiz.deleted','activity',$id);
        Http::json(['status'=>'ok']);
    }

    private static function attempt(PDO $db, string $familyId, string $studentId, string $quizId): never
    {
        $statement=$db->prepare('SELECT q.id,q.correct_option,q.explanation FROM activities a JOIN quiz_questions q ON q.activity_id=a.id JOIN lessons l ON l.id=a.lesson_id JOIN topics t ON t.id=l.topic_id JOIN sections se ON se.id=t.section_id JOIN curriculum_subjects cs ON cs.id=se.curriculum_subject_id JOIN curricula c ON c.id=cs.curriculum_id WHERE a.id=:id AND a.family_id=:family_id AND c.student_id=:student_id AND a.activity_type=\'quiz\' AND a.deleted_at IS NULL AND l.deleted_at IS NULL LIMIT 1');
        $statement->execute(['id'=>$quizId,'family_id'=>$familyId,'student_id'=>$studentId]);
        $question=$statement->fetch();
        if (!$question) Http::error('not_found','Тест не найден в вашей программе',404);
        $selected=(int)(Http::body()['selectedOption']??-1);
        if ($selected<0) Http::error('validation_error','Выберите вариант ответа',422);
        $correct=$selected===(int)$question['correct_option'];
        $attemptId=Uuid::v4();
        $db->beginTransaction();
        try {
            $db->prepare('INSERT INTO quiz_attempts (id,family_id,student_id,activity_id,score) VALUES (:id,:family_id,:student_id,:activity_id,:score)')->execute(['id'=>$attemptId,'family_id'=>$familyId,'student_id'=>$studentId,'activity_id'=>$quizId,'score'=>$correct?100:0]);
            $db->prepare('INSERT INTO quiz_answers (id,attempt_id,question_id,selected_option,is_correct) VALUES (:id,:attempt_id,:question_id,:selected,:correct)')->execute(['id'=>Uuid::v4(),'attempt_id'=>$attemptId,'question_id'=>$question['id'],'selected'=>$selected,'correct'=>$correct?1:0]);
            Audit::record($db,$familyId,'student',$studentId,'quiz.attempted','activity',$quizId,['score'=>$correct?100:0]);
            $db->commit();
        } catch (\Throwable $error) { $db->rollBack(); throw $error; }
        Http::json(['attempt'=>['id'=>$attemptId,'correct'=>$correct,'score'=>$correct?100:0,'explanation'=>$question['explanation']]]);
    }

    private static function parentLesson(PDO $db,string $familyId,string $lessonId): void { $s=$db->prepare('SELECT id FROM lessons WHERE id=:id AND family_id=:family_id AND deleted_at IS NULL');$s->execute(['id'=>$lessonId,'family_id'=>$familyId]);if(!$s->fetchColumn())Http::error('not_found','Урок не найден',404); }
    /** @param array<string,mixed> $row @return array<string,mixed> */
    private static function parentQuiz(array $row): array { return ['id'=>$row['id'],'title'=>$row['title'],'instructions'=>$row['instructions'],'question'=>['id'=>$row['question_id'],'prompt'=>$row['prompt'],'options'=>json_decode((string)$row['options_json'],true,flags:JSON_THROW_ON_ERROR),'correctOption'=>(int)$row['correct_option'],'explanation'=>$row['explanation']]]; }
}
