# HomeEdu — Implementation Status

## Фаза 1 — завершена

- [x] Vite + React + TypeScript workspace
- [x] React Router, Tailwind и базовый адаптивный shell
- [x] ESLint, strict TypeScript, Vitest и production build
- [x] PHP health endpoint
- [x] GitHub Actions CI
- [x] Vision, Road Map, README

## Фаза 2 — серверное ядро готово, интеграционная проверка ожидает MySQL/PHP

- [x] MySQL migration 001
- [x] families, users, students, parent-student links
- [x] parent and student sessions
- [x] setup endpoint for first family
- [x] parent password login
- [x] student PIN login
- [x] student creation and PIN rotation
- [x] role and family access checks
- [x] login rate limiting
- [x] audit events
- [x] API contract and data model documentation
- [x] static PHP parser check
- [x] frontend API client with cookie sessions
- [x] first-family setup screen
- [x] parent login and logout
- [x] session restoration through `/me`
- [x] protected parent/student routes
- [x] server-backed student list and creation form
- [x] switching to a student profile by PIN
- [x] adaptive parent and student shells
- [x] repeatable HTTP integration test for setup, sessions and student PIN login
- [ ] execute migration against a real MySQL 8 database
- [ ] run API integration tests with PHP 8.2 and MySQL

## Фаза 3 — начата

- [x] migration 002 for curricula, subjects, sections, topics and lessons
- [x] block content and activities data model
- [x] competencies and prerequisite links
- [x] database-level family isolation for curriculum relations
- [x] CRUD API for subjects, sections, topics and lessons
- [x] curriculum creation, subject assignment and ordered curriculum tree
- [ ] seed routes «Дроби» for Sara and David
- [x] parent curriculum page for each student
- [x] create curriculum and assign existing or custom subjects
- [x] nested section, topic and lesson creation UI
- [x] responsive ordered curriculum tree
- [x] editing sections, topics and lessons in the UI
- [x] two-step soft-delete flow for curriculum nodes
- [x] lesson block API with family access checks
- [x] lesson editor for text, example, link, video and image blocks
- [x] block editing, deletion and ordering
- [x] Docker Compose environment with MySQL 8.4 and PHP 8.3
- [x] migration 003 for per-student lesson progress
- [x] student-only lesson list and lesson progress API
- [x] student lesson screen with focus mode and resumable block progress

## Следующая задача

Недельный план: родитель назначает конкретные уроки на даты, а экран «Сегодня» показывает обязательный минимум и дополнительные задачи.
