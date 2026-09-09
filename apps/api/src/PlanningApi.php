<?php

declare(strict_types=1);

namespace HomeEdu;

use DateTimeImmutable;
use PDO;

final class PlanningApi
{
    public static function dispatch(PDO $db, string $method, string $path): never
    {
        $session = Auth::requireRole($db, 'parent');
        $familyId = (string) $session['family_id'];
        $actorId = (string) $session['user_id'];
        match (true) {
            $method === 'GET' && preg_match('#^/api/v1/students/([0-9a-f-]{36})/weekly-plan$#', $path, $m) === 1
                => self::getPlan($db, $familyId, $m[1]),
            $method === 'GET' && preg_match('#^/api/v1/students/([0-9a-f-]{36})/progress-report$#', $path, $m) === 1
                => self::progressReport($db, $familyId, $m[1]),
            $method === 'POST' && preg_match('#^/api/v1/students/([0-9a-f-]{36})/plan-items$#', $path, $m) === 1
                => self::addItem($db, $familyId, $actorId, $m[1]),
            $method === 'DELETE' && preg_match('#^/api/v1/plan-items/([0-9a-f-]{36})$#', $path, $m) === 1
                => self::removeItem($db, $familyId, $actorId, $m[1]),
            default => Http::error('not_found', 'Маршрут не найден', 404),
        };
    }

    private static function getPlan(PDO $db, string $familyId, string $studentId): never
    {
        self::assertStudent($db, $familyId, $studentId);
        $weekStart = self::weekStart((string) ($_GET['weekStart'] ?? date('Y-m-d')));
        $weekEnd = $weekStart->modify('+6 days')->format('Y-m-d');
        $lessons = $db->prepare(
            'SELECT l.id, l.title, s.title AS subject_title, s.color AS subject_color
             FROM curricula c JOIN curriculum_subjects cs ON cs.curriculum_id=c.id
             JOIN subjects s ON s.id=cs.subject_id AND s.deleted_at IS NULL
             JOIN sections se ON se.curriculum_subject_id=cs.id AND se.deleted_at IS NULL
             JOIN topics t ON t.section_id=se.id AND t.deleted_at IS NULL
             JOIN lessons l ON l.topic_id=t.id AND l.deleted_at IS NULL
             WHERE c.student_id=:student_id AND c.family_id=:family_id AND c.is_active=TRUE AND c.deleted_at IS NULL
             ORDER BY cs.position,se.position,t.position,l.position'
        );
        $lessons->execute(['student_id' => $studentId, 'family_id' => $familyId]);
        $items = $db->prepare(
            'SELECT pi.id, pi.lesson_id, pi.scheduled_date, pi.is_required, pi.position,
                    l.title, s.title AS subject_title, s.color AS subject_color,
                    COALESCE(lp.status, \'not_started\') AS progress_status
             FROM weekly_plans wp JOIN plan_items pi ON pi.weekly_plan_id=wp.id
             JOIN lessons l ON l.id=pi.lesson_id JOIN topics t ON t.id=l.topic_id
             JOIN sections se ON se.id=t.section_id JOIN curriculum_subjects cs ON cs.id=se.curriculum_subject_id
             JOIN subjects s ON s.id=cs.subject_id
             LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id AND lp.student_id=wp.student_id
             WHERE wp.student_id=:student_id AND wp.family_id=:family_id AND pi.scheduled_date BETWEEN :start AND :end
             ORDER BY pi.scheduled_date,pi.position,pi.created_at'
        );
        $items->execute(['student_id' => $studentId, 'family_id' => $familyId, 'start' => $weekStart->format('Y-m-d'), 'end' => $weekEnd]);
        Http::json(['weekStart' => $weekStart->format('Y-m-d'), 'weekEnd' => $weekEnd,
            'availableLessons' => array_map([self::class, 'lesson'], $lessons->fetchAll()),
            'items' => array_map([self::class, 'item'], $items->fetchAll())]);
    }

    private static function addItem(PDO $db, string $familyId, string $actorId, string $studentId): never
    {
        self::assertStudent($db, $familyId, $studentId);
        $body = Http::body();
        $lessonId = (string) ($body['lessonId'] ?? '');
        $date = self::date((string) ($body['scheduledDate'] ?? ''));
        self::assertAssignedLesson($db, $familyId, $studentId, $lessonId);
        $weekStart = self::weekStart($date)->format('Y-m-d');
        $planId = Uuid::v4();
        $db->prepare('INSERT INTO weekly_plans (id,family_id,student_id,week_start) VALUES (:id,:family_id,:student_id,:week_start) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)')
            ->execute(['id' => $planId, 'family_id' => $familyId, 'student_id' => $studentId, 'week_start' => $weekStart]);
        $lookup = $db->prepare('SELECT id FROM weekly_plans WHERE student_id=:student_id AND week_start=:week_start');
        $lookup->execute(['student_id' => $studentId, 'week_start' => $weekStart]);
        $planId = (string) $lookup->fetchColumn();
        $id = Uuid::v4();
        try {
            $db->prepare('INSERT INTO plan_items (id,family_id,weekly_plan_id,lesson_id,scheduled_date,is_required,position) VALUES (:id,:family_id,:plan_id,:lesson_id,:date,:required,:position)')
                ->execute(['id' => $id, 'family_id' => $familyId, 'plan_id' => $planId, 'lesson_id' => $lessonId, 'date' => $date, 'required' => ($body['isRequired'] ?? true) === true ? 1 : 0, 'position' => max(0, (int) ($body['position'] ?? 0))]);
        } catch (\PDOException $error) {
            if ($error->getCode() === '23000') Http::error('duplicate_plan_item', 'Этот урок уже назначен на выбранный день', 409);
            throw $error;
        }
        Audit::record($db, $familyId, 'parent', $actorId, 'plan_item.created', 'plan_item', $id);
        Http::json(['planItem' => ['id' => $id]], 201);
    }

    private static function progressReport(PDO $db, string $familyId, string $studentId): never
    {
        self::assertStudent($db, $familyId, $studentId);
        $statement = $db->prepare(
            'SELECT pi.id, pi.scheduled_date, pi.is_required, l.id AS lesson_id, l.title,
                    s.title AS subject_title, s.color AS subject_color,
                    COALESCE(lp.status, \'not_started\') AS progress_status, lp.started_at, lp.completed_at,
                    sr.feeling, sr.comment, sr.updated_at AS reflected_at
             FROM weekly_plans wp JOIN plan_items pi ON pi.weekly_plan_id=wp.id
             JOIN lessons l ON l.id=pi.lesson_id JOIN topics t ON t.id=l.topic_id
             JOIN sections se ON se.id=t.section_id JOIN curriculum_subjects cs ON cs.id=se.curriculum_subject_id
             JOIN subjects s ON s.id=cs.subject_id
             LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id AND lp.student_id=wp.student_id
             LEFT JOIN student_reflections sr ON sr.lesson_id=l.id AND sr.student_id=wp.student_id
             WHERE wp.student_id=:student_id AND wp.family_id=:family_id
             ORDER BY pi.scheduled_date DESC, pi.position'
        );
        $statement->execute(['student_id' => $studentId, 'family_id' => $familyId]);
        $items = array_map(static fn (array $row): array => [
            'id'=>$row['id'],'lessonId'=>$row['lesson_id'],'title'=>$row['title'],'subjectTitle'=>$row['subject_title'],'subjectColor'=>$row['subject_color'],
            'scheduledDate'=>$row['scheduled_date'],'isRequired'=>(bool)$row['is_required'],'progressStatus'=>$row['progress_status'],
            'startedAt'=>$row['started_at'],'completedAt'=>$row['completed_at'],
            'reflection'=>$row['feeling'] ? ['feeling'=>$row['feeling'],'comment'=>$row['comment'],'updatedAt'=>$row['reflected_at']] : null,
        ], $statement->fetchAll());
        $summary = ['total'=>count($items),'notStarted'=>0,'inProgress'=>0,'completed'=>0,'needsHelp'=>0];
        foreach ($items as $item) {
            $key = match ($item['progressStatus']) { 'completed'=>'completed','in_progress'=>'inProgress',default=>'notStarted' };
            $summary[$key]++;
            if (($item['reflection']['feeling'] ?? null) === 'need_help') $summary['needsHelp']++;
        }
        Http::json(['summary'=>$summary,'items'=>$items]);
    }

    private static function removeItem(PDO $db, string $familyId, string $actorId, string $id): never
    {
        $statement = $db->prepare('DELETE FROM plan_items WHERE id=:id AND family_id=:family_id');
        $statement->execute(['id' => $id, 'family_id' => $familyId]);
        if ($statement->rowCount() === 0) Http::error('not_found', 'Пункт плана не найден', 404);
        Audit::record($db, $familyId, 'parent', $actorId, 'plan_item.deleted', 'plan_item', $id);
        Http::json(['status' => 'ok']);
    }

    private static function assertStudent(PDO $db, string $familyId, string $studentId): void
    {
        $statement = $db->prepare('SELECT id FROM students WHERE id=:id AND family_id=:family_id AND deleted_at IS NULL');
        $statement->execute(['id' => $studentId, 'family_id' => $familyId]);
        if (!$statement->fetchColumn()) Http::error('not_found', 'Ученик не найден', 404);
    }

    private static function assertAssignedLesson(PDO $db, string $familyId, string $studentId, string $lessonId): void
    {
        $statement = $db->prepare('SELECT l.id FROM curricula c JOIN curriculum_subjects cs ON cs.curriculum_id=c.id JOIN sections se ON se.curriculum_subject_id=cs.id JOIN topics t ON t.section_id=se.id JOIN lessons l ON l.topic_id=t.id WHERE c.student_id=:student_id AND c.family_id=:family_id AND l.id=:lesson_id AND c.deleted_at IS NULL AND l.deleted_at IS NULL');
        $statement->execute(['student_id' => $studentId, 'family_id' => $familyId, 'lesson_id' => $lessonId]);
        if (!$statement->fetchColumn()) Http::error('not_found', 'Урок не входит в программу ученика', 404);
    }

    private static function date(string $value): string
    {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (!$date || $date->format('Y-m-d') !== $value) Http::error('validation_error', 'Укажите корректную дату', 422);
        return $value;
    }

    private static function weekStart(string $date): DateTimeImmutable
    {
        return (new DateTimeImmutable(self::date($date)))->modify('monday this week');
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private static function lesson(array $row): array { return ['id'=>$row['id'],'title'=>$row['title'],'subjectTitle'=>$row['subject_title'],'subjectColor'=>$row['subject_color']]; }
    /** @param array<string,mixed> $row @return array<string,mixed> */
    private static function item(array $row): array { return ['id'=>$row['id'],'lessonId'=>$row['lesson_id'],'scheduledDate'=>$row['scheduled_date'],'isRequired'=>(bool)$row['is_required'],'position'=>(int)$row['position'],'title'=>$row['title'],'subjectTitle'=>$row['subject_title'],'subjectColor'=>$row['subject_color'],'progressStatus'=>$row['progress_status']]; }
}
