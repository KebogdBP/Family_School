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
    error_log($error::class . ': ' . $error->getMessage());
    HomeEdu\Http::json([
        'error' => [
            'code' => 'bootstrap_error',
            'message' => HomeEdu\Env::get('APP_ENV', 'production') === 'development'
                ? $error->getMessage()
                : 'Сервис временно недоступен',
        ],
    ], 500);
});

