# HomeEdu — Implementation Status

## Фаза 1 — завершена

- [x] Vite + React + TypeScript workspace
- [x] React Router, Tailwind и базовый адаптивный shell
- [x] ESLint, strict TypeScript, Vitest и production build
- [x] PHP health endpoint
- [x] GitHub Actions CI
- [x] Vision, Road Map, README

## Фаза 2 — завершена и проверена на MySQL/PHP

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
- [x] execute all migrations against MySQL 8.4 in Docker
- [x] run the complete HTTP integration scenario with PHP 8.3 and MySQL 8.4

## Фазы 3–6 и базовые отчёты — техническое ядро готово

- [x] migration 002 for curricula, subjects, sections, topics and lessons
- [x] block content and activities data model
- [x] competencies and prerequisite links
- [x] database-level family isolation for curriculum relations
- [x] CRUD API for subjects, sections, topics and lessons
- [x] curriculum creation, subject assignment and ordered curriculum tree
- [x] idempotent grade 4 fractions route for David: 4 topics, 7 lessons, 10 linked competencies, 7 quizzes and 4 open works
- [ ] seed route «Обыкновенные дроби» for Sara
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
- [x] migration 004 for weekly plans and dated plan items
- [x] parent weekly planner with required and optional lessons
- [x] isolated student "Today" view
- [x] migration 005 for student reflections
- [x] post-lesson self-assessment UI and API
- [x] parent progress report with help signals
- [x] migration 006 for quiz questions, attempts and answers
- [x] parent single-question quiz constructor
- [x] student quiz flow with server-side scoring and answer privacy
- [x] migration 007 for text homework submissions and immutable reviews
- [x] student draft and submit flow
- [x] parent review queue with grade, comment and revision decision
- [x] migration 008 for private submission file metadata
- [x] secure JPG, PNG and PDF homework uploads outside the public directory
- [x] authenticated file delivery for the owning student and parent family
- [x] migration 009 for multiple-choice, number and short-text quiz answers
- [x] deterministic scoring and parent/student UI for all four quiz question types
- [x] migration 010 for topic mastery states, evidence and review scheduling
- [x] evidence-based topic map for parent and personal review reminders for student
- [x] migration 011 and evidence-backed achievements for revision and durable mastery
- [x] private student achievements page and achievement summary for parent
- [x] aggregated subject progress for parent and student dashboards
- [x] parent-confirmed independent explanation achievement
- [x] migration 012 for per-student assigned-subject mastery rules
- [x] parent UI for evidence thresholds, successful work types and review interval
- [x] automatic personal review tasks generated from mastery schedule
- [x] due review tasks on Today and upcoming reviews on student Progress page
- [x] migration 013 for review attempts and per-question answers
- [x] short review quiz assembled from up to three existing topic questions
- [x] parent review rescheduling and automatic task completion after a passing score
- [x] migration 014 and parent editor for selecting and ordering 1–3 review questions
- [x] automatic question selection remains available until the parent saves a custom set
- [x] personal “continue last lesson” action based on the latest unfinished activity
- [x] unified weekly plan status derived from lesson progress and homework review state
- [x] server-calculated parent daily digest with completion, review queue and help signals
- [x] weekly digest with plan completion, mastered topics, completed reviews, difficulties and deterministic next-plan suggestions
- [x] parent-only versioned JSON export without credentials, sessions, storage names or file contents

## Сверка с Project Vision — 10 сентября 2026

Реализация сохраняет утверждённый стек и продуктовые принципы, но часть поздних функций была сделана до обязательного пилотного контента. До продолжения фазы качества нужно закрыть следующие продуктовые пробелы:

- [x] готовый маршрут «Дроби» для Давида, 4 класс;
- [ ] готовый маршрут «Обыкновенные дроби» для Сары, 6 класс;
- [ ] входная мини-диагностика и выбор первого шага;
- [ ] проверка полного учебного цикла для обоих профилей;
- [ ] минимальный AI Gateway: безопасная подсказка и черновик теста;
- [ ] учёт AI-подсказок в ежедневном отчёте;
- [ ] редактируемый родительский черновик следующего недельного плана;
- [ ] browser e2e для двух пилотных профилей перед реальным использованием;
- [ ] единое автоматическое форматирование кода и production-конфигурация Beget.

Удаление профиля, резервные копии и Beget остаются обязательными, но выполняются после этой последовательности.

## Следующая задача

Создать повторяемый seed-маршрут «Обыкновенные дроби» для Сары, 6 класс.
