<?php

declare(strict_types=1);

use HomeEdu\Audit;
use HomeEdu\Auth;
use HomeEdu\CurriculumApi;
use HomeEdu\Database;
use HomeEdu\Env;
use HomeEdu\Http;
use HomeEdu\HomeworkApi;
use HomeEdu\PlanningApi;
use HomeEdu\QuizApi;
use HomeEdu\RateLimiter;
use HomeEdu\StudentLearningApi;
use HomeEdu\Uuid;

require dirname(__DIR__) . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = rtrim((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), '/') ?: '/';

try {
    if ($method === 'GET' && $path === '/api/v1/health') {
        Http::json(['status' => 'ok', 'service' => 'homeedu-api', 'version' => '0.2.0']);
    }

    $db = Database::connection();

    match (true) {
        $method === 'POST' && $path === '/api/v1/setup' => setupFamily($db),
        $method === 'POST' && $path === '/api/v1/auth/parent/login' => loginParent($db),
        $method === 'POST' && $path === '/api/v1/auth/student/login' => loginStudent($db),
        $method === 'POST' && $path === '/api/v1/auth/logout' => logout($db),
        $method === 'GET' && $path === '/api/v1/me' => currentPrincipal($db),
        $method === 'GET' && $path === '/api/v1/students' => listStudents($db),
        $method === 'POST' && $path === '/api/v1/students' => createStudent($db),
        $method === 'PATCH' && preg_match('#^/api/v1/students/([0-9a-f-]{36})/pin$#', $path, $matches) === 1 => updateStudentPin($db, $matches[1]),
        preg_match('#^/api/v1/(lessons/[0-9a-f-]{36}/quizzes|quizzes/[0-9a-f-]{36}|student/quizzes/[0-9a-f-]{36}/attempts)$#', $path) === 1 => QuizApi::dispatch($db, $method, $path),
        preg_match('#^/api/v1/(lessons/[0-9a-f-]{36}/homeworks|homeworks/[0-9a-f-]{36}|student/homeworks/[0-9a-f-]{36}/(submission|files)|submission-files/[0-9a-f-]{36}|review-submissions|submissions/[0-9a-f-]{36}/reviews)$#', $path) === 1 => HomeworkApi::dispatch($db, $method, $path),
        str_starts_with($path, '/api/v1/student/') => StudentLearningApi::dispatch($db, $method, $path),
        preg_match('#^/api/v1/(students/[0-9a-f-]{36}/(weekly-plan|plan-items|progress-report)|plan-items/[0-9a-f-]{36})$#', $path) === 1 => PlanningApi::dispatch($db, $method, $path),
        default => CurriculumApi::dispatch($db, $method, $path),
    };
} catch (Throwable $error) {
    error_log($error::class . ': ' . $error->getMessage());
    Http::json(['error' => [
        'code' => 'internal_error',
        'message' => Env::get('APP_ENV', 'production') === 'development'
            ? $error->getMessage()
            : 'Внутренняя ошибка сервера',
    ]], 500);
}

function setupFamily(PDO $db): never
{
    $provided = $_SERVER['HTTP_X_SETUP_TOKEN'] ?? '';
    if (!is_string($provided) || !hash_equals(Env::get('APP_SETUP_TOKEN'), $provided)) {
        Http::error('forbidden', 'Настройка запрещена', 403);
    }
    if ((int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0) {
        Http::error('already_configured', 'Семейное пространство уже настроено', 409);
    }

    $body = Http::body();
    $familyName = trim((string) ($body['familyName'] ?? ''));
    $displayName = trim((string) ($body['displayName'] ?? ''));
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $password = (string) ($body['password'] ?? '');
    if ($familyName === '' || $displayName === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        Http::error('validation_error', 'Проверьте название семьи, имя и email', 422);
    }
    if (strlen($password) < 12) {
        Http::error('weak_password', 'Пароль должен содержать не менее 12 символов', 422);
    }

    $familyId = Uuid::v4();
    $userId = Uuid::v4();
    $db->beginTransaction();
    try {
        $db->prepare('INSERT INTO families (id, name) VALUES (:id, :name)')
            ->execute(['id' => $familyId, 'name' => $familyName]);
        $db->prepare(
            'INSERT INTO users (id, family_id, email, password_hash, display_name)
             VALUES (:id, :family_id, :email, :password_hash, :display_name)'
        )->execute([
            'id' => $userId,
            'family_id' => $familyId,
            'email' => $email,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'display_name' => $displayName,
        ]);
        Audit::record($db, $familyId, 'parent', $userId, 'family.created', 'family', $familyId);
        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }

    Auth::issueSession($db, $familyId, 'parent', $userId, null);
    Http::json(['family' => ['id' => $familyId, 'name' => $familyName]], 201);
}

function loginParent(PDO $db): never
{
    $body = Http::body();
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $password = (string) ($body['password'] ?? '');
    $identity = 'parent|' . $email . '|' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    RateLimiter::assertAllowed($db, $identity);

    $statement = $db->prepare(
        'SELECT id, family_id, display_name, password_hash FROM users
         WHERE email = :email AND deleted_at IS NULL LIMIT 1'
    );
    $statement->execute(['email' => $email]);
    $user = $statement->fetch();
    if (!$user || !password_verify($password, (string) $user['password_hash'])) {
        RateLimiter::failed($db, $identity);
        Http::error('invalid_credentials', 'Неверные данные для входа', 401);
    }

    RateLimiter::clear($db, $identity);
    Auth::issueSession($db, $user['family_id'], 'parent', $user['id'], null);
    Audit::record($db, $user['family_id'], 'parent', $user['id'], 'auth.parent_login');
    Http::json(['user' => [
        'id' => $user['id'],
        'role' => 'parent',
        'displayName' => $user['display_name'],
    ]]);
}

function loginStudent(PDO $db): never
{
    $body = Http::body();
    $studentId = strtolower(trim((string) ($body['studentId'] ?? '')));
    $pin = (string) ($body['pin'] ?? '');
    $identity = 'student|' . $studentId . '|' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    RateLimiter::assertAllowed($db, $identity);

    $statement = $db->prepare(
        'SELECT id, family_id, display_name, grade, pin_hash FROM students
         WHERE id = :id AND is_active = TRUE AND deleted_at IS NULL LIMIT 1'
    );
    $statement->execute(['id' => $studentId]);
    $student = $statement->fetch();
    if (!$student || !password_verify($pin, (string) $student['pin_hash'])) {
        RateLimiter::failed($db, $identity);
        Http::error('invalid_credentials', 'Неверные данные для входа', 401);
    }

    RateLimiter::clear($db, $identity);
    Auth::issueSession($db, $student['family_id'], 'student', null, $student['id']);
    Audit::record($db, $student['family_id'], 'student', $student['id'], 'auth.student_login');
    Http::json(['student' => [
        'id' => $student['id'],
        'role' => 'student',
        'displayName' => $student['display_name'],
        'grade' => (int) $student['grade'],
    ]]);
}

function logout(PDO $db): never
{
    Auth::logout($db);
    Http::json(['status' => 'ok']);
}

function currentPrincipal(PDO $db): never
{
    $cookie = $_COOKIE[Env::get('SESSION_COOKIE', 'homeedu_session')] ?? '';
    if (!is_string($cookie) || $cookie === '') {
        Http::error('unauthorized', 'Требуется вход', 401);
    }
    $statement = $db->prepare(
        'SELECT s.role, s.family_id, u.id AS user_id, u.display_name AS user_name,
                st.id AS student_id, st.display_name AS student_name, st.grade
         FROM sessions s LEFT JOIN users u ON u.id = s.user_id
         LEFT JOIN students st ON st.id = s.student_id
         WHERE s.token_hash = :hash AND s.expires_at > NOW() LIMIT 1'
    );
    $statement->execute(['hash' => hash('sha256', $cookie)]);
    $principal = $statement->fetch();
    if (!$principal) {
        Http::error('unauthorized', 'Сессия истекла', 401);
    }
    $isParent = $principal['role'] === 'parent';
    Http::json(['principal' => [
        'role' => $principal['role'],
        'familyId' => $principal['family_id'],
        'id' => $isParent ? $principal['user_id'] : $principal['student_id'],
        'displayName' => $isParent ? $principal['user_name'] : $principal['student_name'],
        'grade' => $isParent ? null : (int) $principal['grade'],
    ]]);
}

function listStudents(PDO $db): never
{
    $session = Auth::requireRole($db, 'parent');
    $statement = $db->prepare(
        'SELECT id, display_name, grade, age, avatar_color, is_active FROM students
         WHERE family_id = :family_id AND deleted_at IS NULL ORDER BY created_at'
    );
    $statement->execute(['family_id' => $session['family_id']]);
    $students = array_map(static fn (array $student): array => [
        'id' => $student['id'],
        'displayName' => $student['display_name'],
        'grade' => (int) $student['grade'],
        'age' => $student['age'] === null ? null : (int) $student['age'],
        'avatarColor' => $student['avatar_color'],
        'isActive' => (bool) $student['is_active'],
    ], $statement->fetchAll());
    Http::json(['students' => $students]);
}

function createStudent(PDO $db): never
{
    $session = Auth::requireRole($db, 'parent');
    $body = Http::body();
    $displayName = trim((string) ($body['displayName'] ?? ''));
    $grade = (int) ($body['grade'] ?? 0);
    $age = isset($body['age']) ? (int) $body['age'] : null;
    $pin = (string) ($body['pin'] ?? '');
    if ($displayName === '' || mb_strlen($displayName) > 120 || $grade < 1 || $grade > 11) {
        Http::error('validation_error', 'Проверьте имя и класс ребёнка', 422);
    }
    if (!preg_match('/^\d{4,8}$/', $pin)) {
        Http::error('invalid_pin', 'PIN должен содержать от 4 до 8 цифр', 422);
    }
    if ($age !== null && ($age < 5 || $age > 19)) {
        Http::error('invalid_age', 'Возраст должен быть от 5 до 19 лет', 422);
    }

    $studentId = Uuid::v4();
    $db->beginTransaction();
    try {
        $db->prepare(
            'INSERT INTO students (id, family_id, display_name, grade, age, pin_hash)
             VALUES (:id, :family_id, :display_name, :grade, :age, :pin_hash)'
        )->execute([
            'id' => $studentId,
            'family_id' => $session['family_id'],
            'display_name' => $displayName,
            'grade' => $grade,
            'age' => $age,
            'pin_hash' => password_hash($pin, PASSWORD_DEFAULT),
        ]);
        $db->prepare('INSERT INTO parent_student_links (parent_id, student_id) VALUES (:parent_id, :student_id)')
            ->execute(['parent_id' => $session['user_id'], 'student_id' => $studentId]);
        Audit::record($db, $session['family_id'], 'parent', $session['user_id'], 'student.created', 'student', $studentId);
        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
    Http::json(['student' => ['id' => $studentId, 'displayName' => $displayName, 'grade' => $grade]], 201);
}

function updateStudentPin(PDO $db, string $studentId): never
{
    $session = Auth::requireRole($db, 'parent');
    $pin = (string) (Http::body()['pin'] ?? '');
    if (!preg_match('/^\d{4,8}$/', $pin)) {
        Http::error('invalid_pin', 'PIN должен содержать от 4 до 8 цифр', 422);
    }
    $statement = $db->prepare(
        'UPDATE students SET pin_hash = :pin_hash WHERE id = :id AND family_id = :family_id AND deleted_at IS NULL'
    );
    $statement->execute([
        'pin_hash' => password_hash($pin, PASSWORD_DEFAULT),
        'id' => $studentId,
        'family_id' => $session['family_id'],
    ]);
    if ($statement->rowCount() !== 1) {
        Http::error('not_found', 'Профиль ребёнка не найден', 404);
    }
    $db->prepare('DELETE FROM sessions WHERE student_id = :student_id')->execute(['student_id' => $studentId]);
    Audit::record($db, $session['family_id'], 'parent', $session['user_id'], 'student.pin_changed', 'student', $studentId);
    Http::json(['status' => 'ok']);
}
