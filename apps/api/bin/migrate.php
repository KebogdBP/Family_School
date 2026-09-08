<?php

declare(strict_types=1);

use HomeEdu\Database;

require dirname(__DIR__) . '/bootstrap.php';

$db = Database::connection();
$db->exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(64) PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);

$applied = $db->query('SELECT version FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN);
$files = glob(dirname(__DIR__) . '/migrations/*.sql') ?: [];
sort($files);

foreach ($files as $file) {
    $version = pathinfo($file, PATHINFO_FILENAME);
    if (in_array($version, $applied, true)) {
        continue;
    }

    $sql = file_get_contents($file);
    if ($sql === false) {
        throw new RuntimeException("Unable to read migration {$version}");
    }

    try {
        $db->exec($sql);
        $statement = $db->prepare(
            'INSERT IGNORE INTO schema_migrations (version) VALUES (:version)'
        );
        $statement->execute(['version' => $version]);
        fwrite(STDOUT, "Applied {$version}\n");
    } catch (Throwable $error) {
        throw $error;
    }
}

fwrite(STDOUT, "Database is up to date.\n");
