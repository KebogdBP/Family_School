<?php

declare(strict_types=1);

namespace HomeEdu;

final class Env
{
    /** @var array<string, string> */
    private static array $values = [];

    public static function load(string $file): void
    {
        if (!is_file($file)) {
            return;
        }

        $values = parse_ini_file($file, false, INI_SCANNER_RAW);
        if ($values === false) {
            throw new \RuntimeException('Unable to read environment configuration.');
        }

        foreach ($values as $key => $value) {
            self::$values[$key] = (string) $value;
        }
    }

    public static function get(string $key, ?string $default = null): string
    {
        $value = getenv($key);
        if ($value !== false) {
            return $value;
        }

        if (array_key_exists($key, self::$values)) {
            return self::$values[$key];
        }

        if ($default !== null) {
            return $default;
        }

        throw new \RuntimeException("Missing required configuration: {$key}");
    }
}

