<?php

declare(strict_types=1);

namespace HomeEdu;

use Throwable;

final class Logger
{
    /** @param array{requestId?: string, method?: string, path?: string, status?: int, phase?: string} $context */
    public static function exception(Throwable $error, array $context = []): void
    {
        $record = [
            'timestamp' => gmdate('c'),
            'level' => 'error',
            'event' => 'request.failed',
            'requestId' => self::text($context['requestId'] ?? null, 80),
            'method' => self::text($context['method'] ?? null, 12),
            'path' => self::path($context['path'] ?? null),
            'status' => isset($context['status']) ? (int) $context['status'] : 500,
            'phase' => self::text($context['phase'] ?? null, 32),
            'exception' => $error::class,
            'source' => basename($error->getFile()) . ':' . $error->getLine(),
            // A one-way fingerprint groups recurring failures without storing their messages.
            'fingerprint' => substr(hash('sha256', $error::class . "\0" . $error->getMessage()), 0, 16),
        ];

        error_log(
            (string) json_encode(
                array_filter($record, static fn(mixed $value): bool => $value !== null && $value !== ''),
                JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR,
            ),
        );
    }

    private static function text(mixed $value, int $limit): ?string
    {
        if (!is_string($value) || $value === '') {
            return null;
        }
        return mb_substr(preg_replace('/[\r\n\t]/u', ' ', $value) ?? '', 0, $limit);
    }

    private static function path(mixed $value): ?string
    {
        if (!is_string($value) || $value === '') {
            return null;
        }
        $path = parse_url($value, PHP_URL_PATH);
        return is_string($path) ? self::text($path, 240) : null;
    }
}
