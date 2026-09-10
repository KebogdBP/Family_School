<?php

declare(strict_types=1);

namespace HomeEdu;

use PDO;

final class DiagnosticApi
{
    public static function dispatch(PDO $db, string $method): never
    {
        $session = Auth::requireRole($db, 'student');
        $familyId = (string) $session['family_id'];
        $studentId = (string) $session['student_id'];
        $student = $db->prepare(
            'SELECT grade FROM students WHERE id=:id AND family_id=:family_id AND deleted_at IS NULL',
        );
        $student->execute(['id' => $studentId, 'family_id' => $familyId]);
        $grade = (int) $student->fetchColumn();
        if ($method === 'GET') {
            self::show($db, $familyId, $studentId, $grade);
        }
        if ($method === 'POST') {
            self::submit($db, $familyId, $studentId, $grade);
        }
        Http::error('method_not_allowed', 'Метод не поддерживается', 405);
    }

    private static function show(PDO $db, string $familyId, string $studentId, int $grade): never
    {
        $route = self::route($db, $familyId, $studentId, $grade);
        if (!$route) {
            Http::json(['available' => false, 'completed' => false]);
        }
        $attempt = self::attempt($db, $studentId, (string) $route['route_code']);
        Http::json([
            'available' => true,
            'completed' => (bool) $attempt,
            'routeTitle' => $grade === 4 ? 'Дроби: стартовая проверка' : 'Обыкновенные дроби: стартовая проверка',
            'questions' => array_map(
                static fn(array $q): array => ['id' => $q['id'], 'prompt' => $q['prompt'], 'options' => $q['options']],
                self::questions($grade),
            ),
            'result' => $attempt ? self::result($db, $attempt) : null,
        ]);
    }

    private static function submit(PDO $db, string $familyId, string $studentId, int $grade): never
    {
        $route = self::route($db, $familyId, $studentId, $grade);
        if (!$route) {
            Http::error('diagnostic_unavailable', 'Сначала родитель должен добавить учебный маршрут', 409);
        }
        $existing = self::attempt($db, $studentId, (string) $route['route_code']);
        if ($existing) {
            Http::json(['completed' => true, 'result' => self::result($db, $existing)]);
        }
        $body = Http::body();
        $answers = $body['answers'] ?? null;
        $questions = self::questions($grade);
        if (!is_array($answers) || count($answers) !== count($questions)) {
            Http::error('validation_error', 'Ответьте на все вопросы', 422);
        }
        $correct = 0;
        $firstIncorrect = null;
        $saved = [];
        foreach ($questions as $index => $question) {
            $answer = $answers[$index] ?? null;
            if (!is_int($answer) || $answer < 0 || $answer >= count($question['options'])) {
                Http::error('validation_error', 'Проверьте ответы', 422);
            }
            $isCorrect = $answer === $question['correct'];
            if ($isCorrect) {
                $correct++;
            } elseif ($firstIncorrect === null) {
                $firstIncorrect = $index;
            }
            $saved[] = ['questionId' => $question['id'], 'selectedOption' => $answer, 'correct' => $isCorrect];
        }
        $score = (int) round(($correct / count($questions)) * 100);
        $topicPosition = $firstIncorrect ?? count($questions) - 1;
        $target = self::target($db, (string) $route['section_id'], $studentId, $topicPosition);
        if (!$target) {
            Http::error('diagnostic_unavailable', 'В маршруте не найден рекомендуемый урок', 409);
        }
        $attemptId = Uuid::v4();
        $db->beginTransaction();
        try {
            $db->prepare(
                'INSERT INTO diagnostic_attempts(id,family_id,student_id,route_code,score,answers_json,recommended_topic_id,recommended_lesson_id) VALUES(:id,:family_id,:student_id,:route_code,:score,:answers,:topic_id,:lesson_id)',
            )->execute([
                'id' => $attemptId,
                'family_id' => $familyId,
                'student_id' => $studentId,
                'route_code' => $route['route_code'],
                'score' => $score,
                'answers' => json_encode($saved, JSON_THROW_ON_ERROR),
                'topic_id' => $target['topic_id'],
                'lesson_id' => $target['lesson_id'],
            ]);
            Mastery::record(
                $db,
                $familyId,
                $studentId,
                (string) $target['topic_id'],
                'diagnostic',
                $attemptId,
                $score >= 75,
                $score,
                'Входная диагностика: ' . $score . '%. Рекомендован старт с темы «' . $target['topic_title'] . '».',
            );
            Audit::record($db, $familyId, 'student', $studentId, 'diagnostic.completed', 'student', $studentId, [
                'routeCode' => $route['route_code'],
                'score' => $score,
                'recommendedTopicId' => $target['topic_id'],
            ]);
            $db->commit();
        } catch (\Throwable $error) {
            $db->rollBack();
            throw $error;
        }
        $attempt = self::attempt($db, $studentId, (string) $route['route_code']);
        Http::json(['completed' => true, 'result' => self::result($db, $attempt)], 201);
    }

    /** @return array<string,mixed>|false */
    private static function route(PDO $db, string $familyId, string $studentId, int $grade): array|false
    {
        $code = $grade === 4 ? 'david-fractions-grade-4-v1' : ($grade === 6 ? 'sara-common-fractions-grade-6-v1' : '');
        if ($code === '') {
            return false;
        }
        $s = $db->prepare(
            'SELECT route_code,curriculum_id,section_id FROM pilot_content_installs WHERE family_id=:family_id AND student_id=:student_id AND route_code=:route AND section_id IS NOT NULL',
        );
        $s->execute(['family_id' => $familyId, 'student_id' => $studentId, 'route' => $code]);
        return $s->fetch();
    }
    /** @return array<string,mixed>|false */
    private static function attempt(PDO $db, string $studentId, string $routeCode): array|false
    {
        $s = $db->prepare('SELECT * FROM diagnostic_attempts WHERE student_id=:student_id AND route_code=:route');
        $s->execute(['student_id' => $studentId, 'route' => $routeCode]);
        return $s->fetch();
    }
    /** @return array<string,mixed>|false */
    private static function target(PDO $db, string $sectionId, string $studentId, int $position): array|false
    {
        $s = $db->prepare(
            'SELECT t.id AS topic_id,t.title AS topic_title,(SELECT l.id FROM lessons l WHERE l.topic_id=t.id AND l.deleted_at IS NULL ORDER BY l.position,l.created_at LIMIT 1) AS lesson_id,(SELECT l.title FROM lessons l WHERE l.topic_id=t.id AND l.deleted_at IS NULL ORDER BY l.position,l.created_at LIMIT 1) AS lesson_title FROM topics t JOIN sections se ON se.id=t.section_id JOIN curriculum_subjects cs ON cs.id=se.curriculum_subject_id JOIN curricula c ON c.id=cs.curriculum_id WHERE se.id=:section_id AND c.student_id=:student_id AND se.deleted_at IS NULL AND t.deleted_at IS NULL ORDER BY t.position,t.created_at LIMIT 1 OFFSET ' .
                $position,
        );
        $s->execute(['section_id' => $sectionId, 'student_id' => $studentId]);
        return $s->fetch();
    }
    /** @param array<string,mixed>|false $attempt @return array<string,mixed> */
    private static function result(PDO $db, array|false $attempt): array
    {
        $s = $db->prepare(
            'SELECT t.title AS topic_title,l.title AS lesson_title FROM diagnostic_attempts da JOIN topics t ON t.id=da.recommended_topic_id JOIN lessons l ON l.id=da.recommended_lesson_id WHERE da.id=:id',
        );
        $s->execute(['id' => $attempt['id']]);
        $target = $s->fetch();
        return [
            'score' => (int) $attempt['score'],
            'recommendedTopicId' => $attempt['recommended_topic_id'],
            'recommendedTopicTitle' => $target['topic_title'],
            'recommendedLessonId' => $attempt['recommended_lesson_id'],
            'recommendedLessonTitle' => $target['lesson_title'],
            'completedAt' => $attempt['completed_at'],
        ];
    }
    /** @return array<int,array<string,mixed>> */
    private static function questions(int $grade): array
    {
        return $grade === 4
            ? [
                [
                    'id' => 'parts',
                    'prompt' => 'Пирог разделили на 8 равных частей и взяли 3. Какая часть взята?',
                    'options' => ['3/8', '8/3', '3/5'],
                    'correct' => 0,
                ],
                [
                    'id' => 'terms',
                    'prompt' => 'Что показывает знаменатель дроби?',
                    'options' => [
                        'Сколько частей взяли',
                        'На сколько равных частей разделили целое',
                        'Сколько частей осталось',
                    ],
                    'correct' => 1,
                ],
                [
                    'id' => 'compare',
                    'prompt' => 'Какая дробь больше?',
                    'options' => ['2/7', '5/7', 'Они равны'],
                    'correct' => 1,
                ],
                [
                    'id' => 'actions',
                    'prompt' => 'Чему равно 2/9 + 4/9?',
                    'options' => ['6/18', '6/9', '2/9'],
                    'correct' => 1,
                ],
            ]
            : [
                [
                    'id' => 'reduce',
                    'prompt' => 'Какая дробь равна 6/8 после сокращения?',
                    'options' => ['3/4', '3/8', '6/4'],
                    'correct' => 0,
                ],
                [
                    'id' => 'denominator',
                    'prompt' => 'Каков наименьший общий знаменатель для 1/6 и 1/4?',
                    'options' => ['10', '12', '24'],
                    'correct' => 1,
                ],
                [
                    'id' => 'compare',
                    'prompt' => 'Какая дробь больше?',
                    'options' => ['3/4', '2/3', 'Они равны'],
                    'correct' => 0,
                ],
                [
                    'id' => 'actions',
                    'prompt' => 'Чему равно 1/3 + 1/6?',
                    'options' => ['2/9', '1/2', '2/6'],
                    'correct' => 1,
                ],
            ];
    }
}
