<?php

declare(strict_types=1);

namespace HomeEdu;

final class Storage
{
    public static function uploadsPath(): string
    {
        $configured = trim(Env::get('UPLOADS_PATH', ''));
        return $configured !== '' ? rtrim($configured, '/\\') : dirname(__DIR__) . '/storage/uploads';
    }

    public static function uploadPath(string $storageName): string
    {
        return self::uploadsPath() . '/' . basename($storageName);
    }

    public static function ensureUploadsPath(): string
    {
        $directory = self::uploadsPath();
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new \RuntimeException('Не удалось создать каталог загрузок');
        }
        if (!is_writable($directory)) {
            throw new \RuntimeException('Каталог загрузок недоступен для записи');
        }
        return $directory;
    }
}
