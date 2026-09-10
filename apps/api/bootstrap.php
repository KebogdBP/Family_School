<?php

declare(strict_types=1);

spl_autoload_register(static function (string $class): void {
    $prefix = 'HomeEdu\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $name = substr($class, strlen($prefix));
    $file = __DIR__ . '/src/' . str_replace('\\', '/', $name) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

HomeEdu\Env::load(__DIR__ . '/.env');

set_exception_handler(static function (Throwable $error): void {
    HomeEdu\Logger::exception($error, [
        'requestId' => HomeEdu\Http::requestId(),
        'method' => $_SERVER['REQUEST_METHOD'] ?? null,
        'path' => $_SERVER['REQUEST_URI'] ?? null,
        'status' => 500,
        'phase' => 'bootstrap',
    ]);
    HomeEdu\Http::json(
        [
            'error' => [
                'code' => 'bootstrap_error',
                'message' => 'Сервис временно недоступен',
                'requestId' => HomeEdu\Http::requestId(),
            ],
        ],
        500,
    );
});
