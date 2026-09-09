<?php

declare(strict_types=1);

namespace HomeEdu;

use PDO;

final class StudentLearningApi
{
    public static function dispatch(PDO $db, string $method, string $path): never
    {
        $session = Auth::requireRole($db, 'student');
        $familyId = (string) $session['family_id'];
        $studentId = (string) $session['student_id'];

        match (true) {
            $method === 'GET' && $path === '/api/v1/student/lessons'
                => self::listLessons($db, $familyId, $studentId),
            $method === 'GET' && preg_match('#^/api/v1/student/lessons/([0-9a-f-]{36})$#', $path, $matches) === 1
                => self::lesson($db, $familyId, $studentId, $matches[1]),
            $method === 'PATCH' && preg_match('#^/api/v1/student/lessons/([0-9a-f-]{36})/progress$#', $path, $matches) === 1
                => self::saveProgress($db, $familyId, $studentId, $matches[1]),
            default => Http::error('not_found', 'Маршрут не найден', 404),
        };
    }

    private static function listLessons(PDO $db, string $familyId, string $studentId): never
    {
        $statement = $db->prepare(
            'SELECT DISTINCT l.id, l.title, l.summary, l.estimated_minutes, l.position,
                    cs.position AS curriculum_subject_position, se.position AS section_position, t.position AS topic_position,
                    s.title AS subject_title, s.color AS subject_color,
                    se.title AS section_title, t.title AS topic_title,
                    COALESCE(lp.status, \'not_started\') AS progress_status,
                    COALESCE(lp.last_block_position, 0) AS last_block_position,
                    (SELECT COUNT(*) FROM content_blocks cb WHERE cb.lesson_id = l.id) AS block_count
             FROM curricula c
             JOIN curriculum_subjects cs ON cs.curriculum_id = c.id AND cs.family_id = c.family_id
             JOIN subjects s ON s.id = cs.subject_id AND s.deleted_at IS NULL
             JOIN sections se ON se.curriculum_subject_id = cs.id AND se.deleted_at IS NULL
             JOIN topics t ON t.section_id = se.id AND t.deleted_at IS NULL
             JOIN lessons l ON l.topic_id = t.id AND l.deleted_at IS NULL
             LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = c.student_id
             WHERE c.student_id = :student_id AND c.family_id = :family_id
                   AND c.is_active = TRUE AND c.deleted_at IS NULL
             ORDER BY cs.position, se.position, t.position, l.position'
        );
        $statement->execute(['student_id' => $studentId, 'family_id' => $familyId]);
        Http::json(['lessons' => array_map([self::class, 'lessonSummary'], $statement->fetchAll())]);
    }

    private static function lesson(PDO $db, string $familyId, string $studentId, string $lessonId): never
    {
        $lesson = self::assignedLesson($db, $familyId, $studentId, $lessonId);
        $blocks = $db->prepare(
            'SELECT id, block_type, content_json, position FROM content_blocks
             WHERE lesson_id = :lesson_id AND family_id = :family_id ORDER BY position, created_at'
        );
        $blocks->execute(['lesson_id' => $lessonId, 'family_id' => $familyId]);
        $lesson['blocks'] = array_map(static fn (array $row): array => [
            'id' => $row['id'], 'blockType' => $row['block_type'],
            'content' => json_decode((string) $row['content_json'], true, flags: JSON_THROW_ON_ERROR),
            'position' => (int) $row['position'],
        ], $blocks->fetchAll());
        Http::json(['lesson' => self::lessonSummary($lesson) + ['blocks' => $lesson['blocks']]]);
    }

    private static function saveProgress(PDO $db, string $familyId, string $studentId, string $lessonId): never
    {
        self::assignedLesson($db, $familyId, $studentId, $lessonId);
        $body = Http::body();
        $lastBlockPosition = (int) ($body['lastBlockPosition'] ?? 0);
        if ($lastBlockPosition < 0) Http::error('validation_error', 'Некорректная позиция блока', 422);
        $completed = ($body['completed'] ?? false) === true;
        $status = $completed ? 'completed' : 'in_progress';
        $id = Uuid::v4();
        $db->prepare(
            'INSERT INTO lesson_progress (id, family_id, student_id, lesson_id, status, last_block_position, completed_at)
             VALUES (:id, :family_id, :student_id, :lesson_id, :status, :position, :completed_at)
             ON DUPLICATE KEY UPDATE status = VALUES(status),
                 last_block_position = GREATEST(last_block_position, VALUES(last_block_position)),
                 completed_at = CASE WHEN VALUES(status) = \'completed\' THEN COALESCE(completed_at, NOW()) ELSE completed_at END'
        )->execute([
            'id' => $id, 'family_id' => $familyId, 'student_id' => $studentId, 'lesson_id' => $lessonId,
            'status' => $status, 'position' => $lastBlockPosition, 'completed_at' => $completed ? date('Y-m-d H:i:s') : null,
        ]);
        Audit::record($db, $familyId, 'student', $studentId, $completed ? 'lesson.completed' : 'lesson.progressed', 'lesson', $lessonId);
        Http::json(['progress' => ['status' => $status, 'lastBlockPosition' => $lastBlockPosition]]);
    }

    /** @return array<string, mixed> */
    private static function assignedLesson(PDO $db, string $familyId, string $studentId, string $lessonId): array
    {
        $statement = $db->prepare(
            'SELECT l.id, l.title, l.summary, l.estimated_minutes, l.position,
                    s.title AS subject_title, s.color AS subject_color, se.title AS section_title, t.title AS topic_title,
                    COALESCE(lp.status, \'not_started\') AS progress_status,
                    COALESCE(lp.last_block_position, 0) AS last_block_position,
                    (SELECT COUNT(*) FROM content_blocks cb WHERE cb.lesson_id = l.id) AS block_count
             FROM curricula c
             JOIN curriculum_subjects cs ON cs.curriculum_id = c.id AND cs.family_id = c.family_id
             JOIN subjects s ON s.id = cs.subject_id AND s.deleted_at IS NULL
             JOIN sections se ON se.curriculum_subject_id = cs.id AND se.deleted_at IS NULL
             JOIN topics t ON t.section_id = se.id AND t.deleted_at IS NULL
             JOIN lessons l ON l.topic_id = t.id AND l.deleted_at IS NULL
             LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = c.student_id
             WHERE c.student_id = :student_id AND c.family_id = :family_id AND l.id = :lesson_id
                   AND c.is_active = TRUE AND c.deleted_at IS NULL LIMIT 1'
        );
        $statement->execute(['student_id' => $studentId, 'family_id' => $familyId, 'lesson_id' => $lessonId]);
        $lesson = $statement->fetch();
        if (!$lesson) Http::error('not_found', 'Урок не найден в вашей программе', 404);
        return $lesson;
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private static function lessonSummary(array $row): array
    {
        return [
            'id' => $row['id'], 'title' => $row['title'], 'summary' => $row['summary'],
            'estimatedMinutes' => $row['estimated_minutes'] === null ? null : (int) $row['estimated_minutes'],
            'subjectTitle' => $row['subject_title'], 'subjectColor' => $row['subject_color'],
            'sectionTitle' => $row['section_title'], 'topicTitle' => $row['topic_title'],
            'progress' => ['status' => $row['progress_status'], 'lastBlockPosition' => (int) $row['last_block_position']],
            'blockCount' => (int) $row['block_count'],
        ];
    }
}
