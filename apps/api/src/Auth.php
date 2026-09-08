<?php

declare(strict_types=1);

namespace HomeEdu;

use PDO;

final class Auth
{
    /** @return array<string, mixed> */
    public static function requireRole(PDO $db, string $requiredRole): array
    {
        $token = $_COOKIE[Env::get('SESSION_COOKIE', 'homeedu_session')] ?? '';
        if (!is_string($token) || strlen($token) < 32) {
            Http::error('unauthorized', 'Требуется вход', 401);
        }

        $statement = $db->prepare(
            'SELECT id, family_id, user_id, student_id, role, expires_at
             FROM sessions WHERE token_hash = :token_hash AND expires_at > NOW() LIMIT 1'
        );
        $statement->execute(['token_hash' => hash('sha256', $token)]);
        $session = $statement->fetch();

        if (!$session || $session['role'] !== $requiredRole) {
            Http::error('forbidden', 'Недостаточно прав', 403);
        }

        $db->prepare('UPDATE sessions SET last_seen_at = NOW() WHERE id = :id')->execute(['id' => $session['id']]);
        return $session;
    }

    public static function issueSession(
        PDO $db,
        string $familyId,
        string $role,
        ?string $userId,
        ?string $studentId,
    ): void {
        $token = bin2hex(random_bytes(32));
        $ttl = max(1, min(720, (int) Env::get('SESSION_TTL_HOURS', '168')));
        $expiresAt = (new \DateTimeImmutable())->modify("+{$ttl} hours");

        $statement = $db->prepare(
            'INSERT INTO sessions (id, token_hash, family_id, user_id, student_id, role, expires_at)
             VALUES (:id, :token_hash, :family_id, :user_id, :student_id, :role, :expires_at)'
        );
        $statement->execute([
            'id' => Uuid::v4(),
            'token_hash' => hash('sha256', $token),
            'family_id' => $familyId,
            'user_id' => $userId,
            'student_id' => $studentId,
            'role' => $role,
            'expires_at' => $expiresAt->format('Y-m-d H:i:s'),
        ]);

        setcookie(Env::get('SESSION_COOKIE', 'homeedu_session'), $token, [
            'expires' => $expiresAt->getTimestamp(),
            'path' => '/',
            'secure' => Env::get('APP_ENV', 'production') === 'production',
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }

    public static function logout(PDO $db): void
    {
        $cookieName = Env::get('SESSION_COOKIE', 'homeedu_session');
        $token = $_COOKIE[$cookieName] ?? '';
        if (is_string($token) && $token !== '') {
            $db->prepare('DELETE FROM sessions WHERE token_hash = :hash')->execute([
                'hash' => hash('sha256', $token),
            ]);
        }

        setcookie($cookieName, '', [
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => Env::get('APP_ENV', 'production') === 'production',
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }
}

