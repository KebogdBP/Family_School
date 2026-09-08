<?php

declare(strict_types=1);

namespace HomeEdu;

use PDO;

final class CurriculumApi
{
    public static function dispatch(PDO $db, string $method, string $path): never
    {
        $session = Auth::requireRole($db, 'parent');
        $familyId = (string) $session['family_id'];
        $actorId = (string) $session['user_id'];

        match (true) {
            $method === 'GET' && $path === '/api/v1/subjects' => self::listSubjects($db, $familyId),
            $method === 'POST' && $path === '/api/v1/subjects' => self::createSubject($db, $familyId, $actorId),
            preg_match('#^/api/v1/(subjects|sections|topics|lessons)/([0-9a-f-]{36})$#', $path, $m) === 1
                && $method === 'PATCH' => self::updateEntity($db, $familyId, $actorId, $m[1], $m[2]),
            preg_match('#^/api/v1/(subjects|sections|topics|lessons)/([0-9a-f-]{36})$#', $path, $m) === 1
                && $method === 'DELETE' => self::deleteEntity($db, $familyId, $actorId, $m[1], $m[2]),
            $method === 'POST' && $path === '/api/v1/curricula' => self::createCurriculum($db, $familyId, $actorId),
            $method === 'GET' && preg_match('#^/api/v1/students/([0-9a-f-]{36})/curricula$#', $path, $m) === 1
                => self::listCurricula($db, $familyId, $m[1]),
            $method === 'GET' && preg_match('#^/api/v1/curricula/([0-9a-f-]{36})$#', $path, $m) === 1
                => self::curriculumTree($db, $familyId, $m[1]),
            $method === 'POST' && preg_match('#^/api/v1/curricula/([0-9a-f-]{36})/subjects$#', $path, $m) === 1
                => self::attachSubject($db, $familyId, $actorId, $m[1]),
            $method === 'POST' && preg_match('#^/api/v1/curriculum-subjects/([0-9a-f-]{36})/sections$#', $path, $m) === 1
                => self::createChild($db, $familyId, $actorId, 'sections', 'curriculum_subject_id', $m[1]),
            $method === 'POST' && preg_match('#^/api/v1/sections/([0-9a-f-]{36})/topics$#', $path, $m) === 1
                => self::createChild($db, $familyId, $actorId, 'topics', 'section_id', $m[1]),
            $method === 'POST' && preg_match('#^/api/v1/topics/([0-9a-f-]{36})/lessons$#', $path, $m) === 1
                => self::createChild($db, $familyId, $actorId, 'lessons', 'topic_id', $m[1]),
            default => Http::error('not_found', 'Маршрут не найден', 404),
        };
    }

    private static function listSubjects(PDO $db, string $familyId): never
    {
        $statement = $db->prepare(
            'SELECT id, title, description, color, is_custom FROM subjects
             WHERE family_id = :family_id AND deleted_at IS NULL ORDER BY title'
        );
        $statement->execute(['family_id' => $familyId]);
        $subjects = array_map(static fn (array $row): array => [
            'id' => $row['id'], 'title' => $row['title'], 'description' => $row['description'],
            'color' => $row['color'], 'isCustom' => (bool) $row['is_custom'],
        ], $statement->fetchAll());
        Http::json(['subjects' => $subjects]);
    }

    private static function createSubject(PDO $db, string $familyId, string $actorId): never
    {
        $body = Http::body();
        $title = self::title($body);
        $description = self::optionalText($body, 'description');
        $color = (string) ($body['color'] ?? '#2563EB');
        if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $color)) {
            Http::error('validation_error', 'Цвет должен быть в формате #RRGGBB', 422);
        }
        $id = Uuid::v4();
        $db->prepare(
            'INSERT INTO subjects (id, family_id, title, description, color)
             VALUES (:id, :family_id, :title, :description, :color)'
        )->execute(['id' => $id, 'family_id' => $familyId, 'title' => $title, 'description' => $description, 'color' => $color]);
        Audit::record($db, $familyId, 'parent', $actorId, 'subject.created', 'subject', $id);
        Http::json(['subject' => compact('id', 'title', 'description', 'color')], 201);
    }

    private static function createCurriculum(PDO $db, string $familyId, string $actorId): never
    {
        $body = Http::body();
        $studentId = (string) ($body['studentId'] ?? '');
        $title = self::title($body);
        $schoolYear = trim((string) ($body['schoolYear'] ?? ''));
        if (!preg_match('/^\d{4}[\/-]\d{4}$/', $schoolYear)) {
            Http::error('validation_error', 'Учебный год должен иметь формат 2026/2027', 422);
        }
        self::assertOwned($db, 'students', $studentId, $familyId);
        $id = Uuid::v4();
        $db->prepare(
            'INSERT INTO curricula (id, family_id, student_id, title, school_year)
             VALUES (:id, :family_id, :student_id, :title, :school_year)'
        )->execute(['id' => $id, 'family_id' => $familyId, 'student_id' => $studentId, 'title' => $title, 'school_year' => $schoolYear]);
        Audit::record($db, $familyId, 'parent', $actorId, 'curriculum.created', 'curriculum', $id);
        Http::json(['curriculum' => ['id' => $id, 'studentId' => $studentId, 'title' => $title, 'schoolYear' => $schoolYear]], 201);
    }

    private static function listCurricula(PDO $db, string $familyId, string $studentId): never
    {
        self::assertOwned($db, 'students', $studentId, $familyId);
        $statement = $db->prepare(
            'SELECT id, title, school_year, is_active FROM curricula
             WHERE student_id = :student_id AND family_id = :family_id AND deleted_at IS NULL
             ORDER BY school_year DESC'
        );
        $statement->execute(['student_id' => $studentId, 'family_id' => $familyId]);
        Http::json(['curricula' => array_map(static fn (array $row): array => [
            'id' => $row['id'], 'title' => $row['title'], 'schoolYear' => $row['school_year'],
            'isActive' => (bool) $row['is_active'],
        ], $statement->fetchAll())]);
    }

    private static function attachSubject(PDO $db, string $familyId, string $actorId, string $curriculumId): never
    {
        $body = Http::body();
        $subjectId = (string) ($body['subjectId'] ?? '');
        $position = self::position($body);
        self::assertOwned($db, 'curricula', $curriculumId, $familyId);
        self::assertOwned($db, 'subjects', $subjectId, $familyId);
        $id = Uuid::v4();
        $db->prepare(
            'INSERT INTO curriculum_subjects (id, family_id, curriculum_id, subject_id, position)
             VALUES (:id, :family_id, :curriculum_id, :subject_id, :position)'
        )->execute(['id' => $id, 'family_id' => $familyId, 'curriculum_id' => $curriculumId, 'subject_id' => $subjectId, 'position' => $position]);
        Audit::record($db, $familyId, 'parent', $actorId, 'curriculum.subject_attached', 'curriculum_subject', $id);
        Http::json(['curriculumSubject' => ['id' => $id, 'subjectId' => $subjectId, 'position' => $position]], 201);
    }

    private static function createChild(PDO $db, string $familyId, string $actorId, string $table, string $parentColumn, string $parentId): never
    {
        $parents = ['sections' => 'curriculum_subjects', 'topics' => 'sections', 'lessons' => 'topics'];
        self::assertOwned($db, $parents[$table], $parentId, $familyId);
        $body = Http::body();
        $title = self::title($body);
        $description = self::optionalText($body, $table === 'lessons' ? 'summary' : 'description');
        $position = self::position($body);
        $id = Uuid::v4();
        $textColumn = $table === 'lessons' ? 'summary' : 'description';
        $sql = "INSERT INTO {$table} (id, family_id, {$parentColumn}, title, {$textColumn}, position)
                VALUES (:id, :family_id, :parent_id, :title, :description, :position)";
        $db->prepare($sql)->execute(['id' => $id, 'family_id' => $familyId, 'parent_id' => $parentId, 'title' => $title, 'description' => $description, 'position' => $position]);
        $entity = rtrim($table, 's');
        Audit::record($db, $familyId, 'parent', $actorId, "{$entity}.created", $entity, $id);
        Http::json([$entity => ['id' => $id, 'title' => $title, 'position' => $position]], 201);
    }

    private static function updateEntity(PDO $db, string $familyId, string $actorId, string $table, string $id): never
    {
        self::assertOwned($db, $table, $id, $familyId);
        $body = Http::body();
        $title = self::title($body);
        if ($table === 'subjects') {
            $description = self::optionalText($body, 'description');
            $color = (string) ($body['color'] ?? '#2563EB');
            if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $color)) Http::error('validation_error', 'Некорректный цвет', 422);
            $db->prepare('UPDATE subjects SET title=:title, description=:description, color=:color WHERE id=:id AND family_id=:family_id')
                ->execute(['title' => $title, 'description' => $description, 'color' => $color, 'id' => $id, 'family_id' => $familyId]);
        } else {
            $textColumn = $table === 'lessons' ? 'summary' : 'description';
            $description = self::optionalText($body, $textColumn);
            $position = self::position($body);
            $sql = "UPDATE {$table} SET title=:title, {$textColumn}=:description, position=:position
                    WHERE id=:id AND family_id=:family_id";
            $db->prepare($sql)->execute(['title' => $title, 'description' => $description, 'position' => $position, 'id' => $id, 'family_id' => $familyId]);
        }
        $entity = rtrim($table, 's');
        Audit::record($db, $familyId, 'parent', $actorId, "{$entity}.updated", $entity, $id);
        Http::json(['status' => 'ok']);
    }

    private static function deleteEntity(PDO $db, string $familyId, string $actorId, string $table, string $id): never
    {
        self::assertOwned($db, $table, $id, $familyId);
        $db->prepare("UPDATE {$table} SET deleted_at = NOW() WHERE id = :id AND family_id = :family_id")
            ->execute(['id' => $id, 'family_id' => $familyId]);
        $entity = rtrim($table, 's');
        Audit::record($db, $familyId, 'parent', $actorId, "{$entity}.deleted", $entity, $id);
        Http::json(['status' => 'ok']);
    }

    private static function curriculumTree(PDO $db, string $familyId, string $curriculumId): never
    {
        $statement = $db->prepare(
            'SELECT c.id, c.student_id, c.title, c.school_year, cs.id AS curriculum_subject_id,
                    cs.position AS subject_position, s.id AS subject_id, s.title AS subject_title, s.color,
                    se.id AS section_id, se.title AS section_title, se.position AS section_position,
                    t.id AS topic_id, t.title AS topic_title, t.position AS topic_position,
                    l.id AS lesson_id, l.title AS lesson_title, l.summary, l.position AS lesson_position, l.status
             FROM curricula c
             LEFT JOIN curriculum_subjects cs ON cs.curriculum_id = c.id AND cs.family_id = c.family_id
             LEFT JOIN subjects s ON s.id = cs.subject_id AND s.deleted_at IS NULL
             LEFT JOIN sections se ON se.curriculum_subject_id = cs.id AND se.deleted_at IS NULL
             LEFT JOIN topics t ON t.section_id = se.id AND t.deleted_at IS NULL
             LEFT JOIN lessons l ON l.topic_id = t.id AND l.deleted_at IS NULL
             WHERE c.id = :id AND c.family_id = :family_id AND c.deleted_at IS NULL
             ORDER BY cs.position, se.position, t.position, l.position'
        );
        $statement->execute(['id' => $curriculumId, 'family_id' => $familyId]);
        $rows = $statement->fetchAll();
        if ($rows === []) Http::error('not_found', 'Учебная программа не найдена', 404);
        $first = $rows[0];
        $tree = ['id' => $first['id'], 'studentId' => $first['student_id'], 'title' => $first['title'], 'schoolYear' => $first['school_year'], 'subjects' => []];
        foreach ($rows as $row) {
            if ($row['curriculum_subject_id'] === null || $row['subject_id'] === null) continue;
            $subjectKey = (string) $row['curriculum_subject_id'];
            $tree['subjects'][$subjectKey] ??= ['id' => $row['subject_id'], 'assignmentId' => $subjectKey, 'title' => $row['subject_title'], 'color' => $row['color'], 'position' => (int) $row['subject_position'], 'sections' => []];
            if ($row['section_id'] === null) continue;
            $sectionKey = (string) $row['section_id'];
            $tree['subjects'][$subjectKey]['sections'][$sectionKey] ??= ['id' => $sectionKey, 'title' => $row['section_title'], 'position' => (int) $row['section_position'], 'topics' => []];
            if ($row['topic_id'] === null) continue;
            $topicKey = (string) $row['topic_id'];
            $tree['subjects'][$subjectKey]['sections'][$sectionKey]['topics'][$topicKey] ??= ['id' => $topicKey, 'title' => $row['topic_title'], 'position' => (int) $row['topic_position'], 'lessons' => []];
            if ($row['lesson_id'] !== null) {
                $tree['subjects'][$subjectKey]['sections'][$sectionKey]['topics'][$topicKey]['lessons'][] = [
                    'id' => $row['lesson_id'], 'title' => $row['lesson_title'], 'summary' => $row['summary'],
                    'position' => (int) $row['lesson_position'], 'status' => $row['status'],
                ];
            }
        }
        $tree['subjects'] = self::valuesDeep($tree['subjects']);
        Http::json(['curriculum' => $tree]);
    }

    /** @param array<string, mixed> $items @return array<int, mixed> */
    private static function valuesDeep(array $items): array
    {
        foreach ($items as &$subject) {
            $subject['sections'] = array_values($subject['sections']);
            foreach ($subject['sections'] as &$section) $section['topics'] = array_values($section['topics']);
        }
        return array_values($items);
    }

    private static function assertOwned(PDO $db, string $table, string $id, string $familyId): void
    {
        $allowed = ['students', 'subjects', 'curricula', 'curriculum_subjects', 'sections', 'topics', 'lessons'];
        if (!in_array($table, $allowed, true) || !preg_match('/^[0-9a-f-]{36}$/', $id)) Http::error('not_found', 'Сущность не найдена', 404);
        $statement = $db->prepare("SELECT id FROM {$table} WHERE id = :id AND family_id = :family_id" . ($table === 'curriculum_subjects' ? '' : ' AND deleted_at IS NULL'));
        $statement->execute(['id' => $id, 'family_id' => $familyId]);
        if (!$statement->fetchColumn()) Http::error('not_found', 'Сущность не найдена', 404);
    }

    /** @param array<string, mixed> $body */
    private static function title(array $body): string
    {
        $title = trim((string) ($body['title'] ?? ''));
        if ($title === '' || mb_strlen($title) > 180) Http::error('validation_error', 'Название обязательно и не длиннее 180 символов', 422);
        return $title;
    }

    /** @param array<string, mixed> $body */
    private static function optionalText(array $body, string $key): ?string
    {
        $value = trim((string) ($body[$key] ?? ''));
        return $value === '' ? null : $value;
    }

    /** @param array<string, mixed> $body */
    private static function position(array $body): int
    {
        $position = (int) ($body['position'] ?? 0);
        if ($position < 0) Http::error('validation_error', 'Позиция не может быть отрицательной', 422);
        return $position;
    }
}
