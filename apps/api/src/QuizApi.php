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
            if (
                $method === 'POST' &&
                preg_match('#^/api/v1/student/quizzes/([0-9a-f-]{36})/attempts$#', $path, $m) === 1
            ) {
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
            $method === 'DELETE' && preg_match('#^/api/v1/quizzes/([0-9a-f-]{36})$#', $path, $m) === 1 => self::delete(
                $db,
                $familyId,
                $actorId,
                $m[1],
            ),
            default => Http::error('not_found', 'Маршрут не найден', 404),
        };
    }

    private static function list(PDO $db, string $familyId, string $lessonId): never
    {
        self::parentLesson($db, $familyId, $lessonId);
        $statement = $db->prepare(
            'SELECT a.id,a.title,a.instructions,q.id AS question_id,q.prompt,q.question_type,q.options_json,q.correct_answer_json,q.explanation FROM activities a JOIN quiz_questions q ON q.activity_id=a.id WHERE a.lesson_id=:lesson_id AND a.family_id=:family_id AND a.activity_type=\'quiz\' AND a.deleted_at IS NULL ORDER BY a.position,a.created_at',
        );
        $statement->execute(['lesson_id' => $lessonId, 'family_id' => $familyId]);
        Http::json(['quizzes' => array_map([self::class, 'parentQuiz'], $statement->fetchAll())]);
    }

    private static function create(PDO $db, string $familyId, string $actorId, string $lessonId): never
    {
        self::parentLesson($db, $familyId, $lessonId);
        $body = Http::body();
        $title = trim((string) ($body['title'] ?? 'Мини-тест'));
        $prompt = trim((string) ($body['prompt'] ?? ''));
        $type = (string) ($body['questionType'] ?? 'single_choice');
        $options = $body['options'] ?? [];
        $explanation = trim((string) ($body['explanation'] ?? ''));
        if (
            $title === '' ||
            $prompt === '' ||
            !in_array($type, ['single_choice', 'multiple_choice', 'number', 'short_text'], true)
        ) {
            Http::error('validation_error', 'Проверьте название, вопрос и тип ответа', 422);
        }
        [$options, $answer] = self::validateQuestion($type, $options, $body);
        $activityId = Uuid::v4();
        $questionId = Uuid::v4();
        $db->beginTransaction();
        try {
            $db->prepare(
                'INSERT INTO activities (id,family_id,lesson_id,activity_type,title,instructions,position) VALUES (:id,:family_id,:lesson_id,\'quiz\',:title,:instructions,:position)',
            )->execute([
                'id' => $activityId,
                'family_id' => $familyId,
                'lesson_id' => $lessonId,
                'title' => $title,
                'instructions' => null,
                'position' => max(0, (int) ($body['position'] ?? 0)),
            ]);
            $db->prepare(
                'INSERT INTO quiz_questions (id,family_id,activity_id,prompt,question_type,options_json,correct_answer_json,explanation) VALUES (:id,:family_id,:activity_id,:prompt,:type,:options,:answer,:explanation)',
            )->execute([
                'id' => $questionId,
                'family_id' => $familyId,
                'activity_id' => $activityId,
                'prompt' => $prompt,
                'type' => $type,
                'options' =>
                    $options === [] ? null : json_encode($options, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                'answer' => json_encode($answer, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                'explanation' => $explanation === '' ? null : $explanation,
            ]);
            Audit::record($db, $familyId, 'parent', $actorId, 'quiz.created', 'activity', $activityId);
            $db->commit();
        } catch (\Throwable $error) {
            $db->rollBack();
            throw $error;
        }
        Http::json(['quiz' => ['id' => $activityId]], 201);
    }

    private static function delete(PDO $db, string $familyId, string $actorId, string $id): never
    {
        $statement = $db->prepare(
            'UPDATE activities SET deleted_at=NOW() WHERE id=:id AND family_id=:family_id AND activity_type=\'quiz\' AND deleted_at IS NULL',
        );
        $statement->execute(['id' => $id, 'family_id' => $familyId]);
        if ($statement->rowCount() === 0) {
            Http::error('not_found', 'Тест не найден', 404);
        }
        Audit::record($db, $familyId, 'parent', $actorId, 'quiz.deleted', 'activity', $id);
        Http::json(['status' => 'ok']);
    }

    private static function attempt(PDO $db, string $familyId, string $studentId, string $quizId): never
    {
        $statement = $db->prepare(
            'SELECT q.id,q.question_type,q.options_json,q.correct_answer_json,q.explanation,t.id AS topic_id FROM activities a JOIN quiz_questions q ON q.activity_id=a.id JOIN lessons l ON l.id=a.lesson_id JOIN topics t ON t.id=l.topic_id JOIN sections se ON se.id=t.section_id JOIN curriculum_subjects cs ON cs.id=se.curriculum_subject_id JOIN curricula c ON c.id=cs.curriculum_id WHERE a.id=:id AND a.family_id=:family_id AND c.student_id=:student_id AND a.activity_type=\'quiz\' AND a.deleted_at IS NULL AND l.deleted_at IS NULL LIMIT 1',
        );
        $statement->execute(['id' => $quizId, 'family_id' => $familyId, 'student_id' => $studentId]);
        $question = $statement->fetch();
        if (!$question) {
            Http::error('not_found', 'Тест не найден в вашей программе', 404);
        }
        $body = Http::body();
        $answer = self::studentAnswer((string) $question['question_type'], $body);
        $expected = json_decode((string) $question['correct_answer_json'], true, flags: JSON_THROW_ON_ERROR);
        $correct = self::isCorrect((string) $question['question_type'], $answer, $expected);
        $attemptId = Uuid::v4();
        $db->beginTransaction();
        try {
            $db->prepare(
                'INSERT INTO quiz_attempts (id,family_id,student_id,activity_id,score) VALUES (:id,:family_id,:student_id,:activity_id,:score)',
            )->execute([
                'id' => $attemptId,
                'family_id' => $familyId,
                'student_id' => $studentId,
                'activity_id' => $quizId,
                'score' => $correct ? 100 : 0,
            ]);
            $db->prepare(
                'INSERT INTO quiz_answers (id,attempt_id,question_id,answer_json,is_correct) VALUES (:id,:attempt_id,:question_id,:answer,:correct)',
            )->execute([
                'id' => Uuid::v4(),
                'attempt_id' => $attemptId,
                'question_id' => $question['id'],
                'answer' => json_encode($answer, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                'correct' => $correct ? 1 : 0,
            ]);
            Mastery::record(
                $db,
                $familyId,
                $studentId,
                (string) $question['topic_id'],
                'quiz',
                $attemptId,
                $correct,
                $correct ? 100 : 0,
                $correct ? 'Тест выполнен верно.' : 'В тесте допущена ошибка — тему стоит повторить.',
            );
            Audit::record($db, $familyId, 'student', $studentId, 'quiz.attempted', 'activity', $quizId, [
                'score' => $correct ? 100 : 0,
            ]);
            $db->commit();
        } catch (\Throwable $error) {
            $db->rollBack();
            throw $error;
        }
        Http::json([
            'attempt' => [
                'id' => $attemptId,
                'correct' => $correct,
                'score' => $correct ? 100 : 0,
                'explanation' => $question['explanation'],
            ],
        ]);
    }

    /** @return array{0:array<int,string>,1:array<string,mixed>} */
    private static function validateQuestion(string $type, mixed $rawOptions, array $body): array
    {
        $options = is_array($rawOptions)
            ? array_map(static fn(mixed $v): string => trim((string) $v), array_values($rawOptions))
            : [];
        if (in_array($type, ['single_choice', 'multiple_choice'], true)) {
            if (count($options) < 2 || count($options) > 6 || in_array('', $options, true)) {
                Http::error('validation_error', 'Добавьте от 2 до 6 заполненных вариантов', 422);
            }
            $correct = array_values(
                array_unique(
                    array_map(
                        'intval',
                        (array) ($body['correctOptions'] ??
                            (isset($body['correctOption']) ? [$body['correctOption']] : [])),
                    ),
                ),
            );
            if (
                $correct === [] ||
                min($correct) < 0 ||
                max($correct) >= count($options) ||
                ($type === 'single_choice' && count($correct) !== 1)
            ) {
                Http::error('validation_error', 'Проверьте правильные варианты', 422);
            }
            sort($correct);
            return [$options, ['options' => $correct]];
        }
        if ($type === 'number') {
            $value = filter_var($body['correctNumber'] ?? null, FILTER_VALIDATE_FLOAT);
            $tolerance = filter_var($body['tolerance'] ?? 0, FILTER_VALIDATE_FLOAT);
            if ($value === false || $tolerance === false || (float) $tolerance < 0) {
                Http::error('validation_error', 'Укажите число и неотрицательную погрешность', 422);
            }
            return [[], ['value' => (float) $value, 'tolerance' => (float) $tolerance]];
        }
        $accepted = array_values(
            array_filter(
                array_map(static fn(mixed $v): string => trim((string) $v), (array) ($body['acceptedAnswers'] ?? [])),
                static fn(string $v): bool => $v !== '',
            ),
        );
        if ($accepted === [] || count($accepted) > 10) {
            Http::error('validation_error', 'Добавьте от 1 до 10 допустимых ответов', 422);
        }
        return [[], ['accepted' => $accepted]];
    }

    /** @return array<string,mixed> */
    private static function studentAnswer(string $type, array $body): array
    {
        if ($type === 'single_choice') {
            $value = filter_var($body['selectedOption'] ?? null, FILTER_VALIDATE_INT);
            if ($value === false || $value < 0) {
                Http::error('validation_error', 'Выберите вариант ответа', 422);
            }
            return ['options' => [(int) $value]];
        }
        if ($type === 'multiple_choice') {
            $values = array_values(array_unique(array_map('intval', (array) ($body['selectedOptions'] ?? []))));
            if ($values === [] || min($values) < 0) {
                Http::error('validation_error', 'Выберите хотя бы один вариант', 422);
            }
            sort($values);
            return ['options' => $values];
        }
        if ($type === 'number') {
            $value = filter_var($body['numberAnswer'] ?? null, FILTER_VALIDATE_FLOAT);
            if ($value === false) {
                Http::error('validation_error', 'Введите числовой ответ', 422);
            }
            return ['value' => (float) $value];
        }
        $value = trim((string) ($body['textAnswer'] ?? ''));
        if ($value === '' || mb_strlen($value) > 500) {
            Http::error('validation_error', 'Введите короткий ответ', 422);
        }
        return ['value' => $value];
    }

    private static function isCorrect(string $type, array $answer, array $expected): bool
    {
        if (in_array($type, ['single_choice', 'multiple_choice'], true)) {
            return ($answer['options'] ?? []) === ($expected['options'] ?? []);
        }
        if ($type === 'number') {
            return abs((float) $answer['value'] - (float) $expected['value']) <= (float) ($expected['tolerance'] ?? 0);
        }
        $normalize = static fn(string $v): string => mb_strtolower((string) preg_replace('/\\s+/u', ' ', trim($v)));
        return in_array(
            $normalize((string) $answer['value']),
            array_map($normalize, (array) ($expected['accepted'] ?? [])),
            true,
        );
    }

    /** @return array{0:array<string,mixed>,1:bool} */
    public static function evaluate(string $type, array $body, array $expected): array
    {
        $answer = self::studentAnswer($type, $body);
        return [$answer, self::isCorrect($type, $answer, $expected)];
    }

    private static function parentLesson(PDO $db, string $familyId, string $lessonId): void
    {
        $s = $db->prepare('SELECT id FROM lessons WHERE id=:id AND family_id=:family_id AND deleted_at IS NULL');
        $s->execute(['id' => $lessonId, 'family_id' => $familyId]);
        if (!$s->fetchColumn()) {
            Http::error('not_found', 'Урок не найден', 404);
        }
    }
    /** @param array<string,mixed> $row @return array<string,mixed> */
    private static function parentQuiz(array $row): array
    {
        return [
            'id' => $row['id'],
            'title' => $row['title'],
            'instructions' => $row['instructions'],
            'question' => [
                'id' => $row['question_id'],
                'prompt' => $row['prompt'],
                'questionType' => $row['question_type'],
                'options' => $row['options_json']
                    ? json_decode((string) $row['options_json'], true, flags: JSON_THROW_ON_ERROR)
                    : [],
                'correctAnswer' => json_decode((string) $row['correct_answer_json'], true, flags: JSON_THROW_ON_ERROR),
                'explanation' => $row['explanation'],
            ],
        ];
    }
}
