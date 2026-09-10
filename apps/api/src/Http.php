<?php

declare(strict_types=1);

namespace HomeEdu;

final class Http
{
    private static ?string $requestId = null;

    public static function requestId(): string
    {
        if (self::$requestId !== null) {
            return self::$requestId;
        }
        $provided = $_SERVER['HTTP_X_REQUEST_ID'] ?? '';
        self::$requestId =
            is_string($provided) && preg_match('/^[A-Za-z0-9._-]{8,80}$/', $provided) === 1
                ? $provided
                : bin2hex(random_bytes(12));
        return self::$requestId;
    }

    /** @param array<string, mixed> $payload */
    public static function json(array $payload, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('X-Request-ID: ' . self::requestId());
        header('Cache-Control: no-store');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        exit();
    }

    /** @return array<string, mixed> */
    public static function body(): array
    {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (!str_starts_with(strtolower($contentType), 'application/json')) {
            self::error('unsupported_media_type', 'Требуется Content-Type: application/json', 415);
        }

        $raw = file_get_contents('php://input');
        $data = json_decode($raw ?: '{}', true);
        if (!is_array($data)) {
            self::error('invalid_json', 'Некорректный JSON', 400);
        }

        return $data;
    }

    public static function error(string $code, string $message, int $status): never
    {
        self::json(['error' => ['code' => $code, 'message' => $message]], $status);
    }
}
