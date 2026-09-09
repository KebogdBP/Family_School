# HomeEdu

HomeEdu — веб-приложение для семейного образования. Первый пилот рассчитан на Сару (6 класс) и Давида (4 класс).

## Стек

- React, TypeScript, Vite;
- Tailwind CSS, shadcn/ui, Radix UI;
- PHP REST API;
- MySQL;
- Vitest, Testing Library и HTTP-интеграционные тесты.

## Локальный запуск frontend

```bash
npm install
npm run dev
```

## Локальный запуск API

Нужны PHP 8.2 или новее и MySQL 8.

```bash
cp apps/api/.env.example apps/api/.env
php apps/api/bin/migrate.php
php -S 127.0.0.1:8080 -t apps/api/public
```

Проверка API: `GET http://127.0.0.1:8080/api/v1/health`.

### Рекомендуемый запуск через Docker

Этот вариант не собирает MySQL и LLVM на macOS. Нужен Docker Desktop или совместимый Docker Runtime. Для Intel Mac на macOS Ventura используйте Docker Desktop 4.48.0: начиная с 4.49.0 требуется macOS 14.

```bash
docker compose up -d --build
docker compose exec api php bin/migrate.php
npm run test:api:integration
```

MySQL 8.4 работает в контейнере с отдельным volume, API доступен на `http://127.0.0.1:8080`. Пароли в `compose.yaml` предназначены только для локальной разработки и должны быть заменены при деплое.

Frontend обращается к API по пути `/api/v1`. В production web-сервер должен отдавать собранный `apps/web/dist` и проксировать `/api/v1/*` в `apps/api/public/index.php`. Для локальной совместной разработки укажите такой же reverse proxy либо запускайте frontend через конфигурацию сервера.

После миграции откройте `/setup`, создайте первое семейное пространство с ключом `APP_SETUP_TOKEN`, затем добавьте Сару (6 класс) и Давида (4 класс) с отдельными PIN-кодами.

## Проверки

```bash
npm run test:quality
```

Команда последовательно запускает ESLint, проверку TypeScript, быстрые frontend-тесты, проверку синтаксиса PHP и production-сборку. `npm test` запускает только быстрые тесты Vitest.

После запуска API на чистой тестовой базе полный сценарий авторизации можно проверить командой:

```bash
HOMEEDU_SETUP_TOKEN=development-setup-token npm run test:api:integration
```

Интеграционный сценарий проверяет регистрацию семьи, раздельные профили Сары и Давида, учебные маршруты, диагностику, тесты, домашние задания, файлы, проверку родителем, повторение, достижения, отчёты и запрет доступа к чужим данным. В GitHub Actions он автоматически выполняется в отдельных Docker-контейнерах PHP 8.3 и MySQL 8.4 при каждом push и pull request.

## AI Gateway

По умолчанию `AI_PROVIDER=disabled`: подсказки и тестовые черновики работают через локальный безопасный fallback и не требуют ключа. Для подключения OpenAI задайте только в серверном `.env` значения `AI_PROVIDER=openai`, `AI_API_KEY` и при необходимости `AI_MODEL`. Ключ никогда не передаётся во frontend. Тест, созданный AI, остаётся черновиком до отдельного утверждения родителем.

## Документация

- `docs/PROJECT_VISION.md` — продуктовая концепция;
- `docs/ROAD_MAP.md` — этапы реализации и критерии готовности.
- `docs/api-contract.md` — контракт текущих API-маршрутов;
- `docs/data-model.md` — модель данных и инварианты доступа;
- `docs/IMPLEMENTATION_STATUS.md` — фактическое состояние реализации.
