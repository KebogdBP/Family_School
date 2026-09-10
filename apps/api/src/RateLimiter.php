<?php

declare(strict_types=1);

namespace HomeEdu;

use PDO;

final class RateLimiter
{
    public static function assertAllowed(PDO $db, string $identity): void
    {
        $hash = hash('sha256', $identity);
        $statement = $db->prepare('SELECT locked_until FROM auth_attempts WHERE identity_hash = :hash');
        $statement->execute(['hash' => $hash]);
        $attempt = $statement->fetch();

        if ($attempt && $attempt['locked_until'] !== null && strtotime((string) $attempt['locked_until']) > time()) {
            Http::error('too_many_attempts', 'Слишком много попыток. Попробуйте позже.', 429);
        }
    }

    public static function failed(PDO $db, string $identity): void
    {
        $hash = hash('sha256', $identity);
        $statement = $db->prepare(
            'INSERT INTO auth_attempts (identity_hash, attempts, window_started_at, locked_until)
             VALUES (:hash, 1, NOW(), NULL)
             ON DUPLICATE KEY UPDATE
               attempts = IF(window_started_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE), 1, attempts + 1),
               window_started_at = IF(window_started_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE), NOW(), window_started_at),
               locked_until = IF(attempts >= 4, DATE_ADD(NOW(), INTERVAL 15 MINUTE), locked_until)',
        );
        $statement->execute(['hash' => $hash]);
    }

    public static function clear(PDO $db, string $identity): void
    {
        $statement = $db->prepare('DELETE FROM auth_attempts WHERE identity_hash = :hash');
        $statement->execute(['hash' => hash('sha256', $identity)]);
    }
}
