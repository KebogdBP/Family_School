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

## Следующая задача

Добавить отдельную короткую контрольную для повторения вместо повторного открытия всего урока.
