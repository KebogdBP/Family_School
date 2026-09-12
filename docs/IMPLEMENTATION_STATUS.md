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
- [x] полный КТП математики Давида на 2026/27 год: 5 разделов, 63 темы, 63 объяснения и 63 закрепляющих мини-теста
- [x] idempotent grade 6 common fractions route for Sara: 4 topics, 8 lessons, 11 linked competencies, 8 quizzes and 4 open works
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

## Сверка с Project Vision — 12 сентября 2026

Реализация сохраняет утверждённый стек и продуктовые принципы, но часть поздних функций была сделана до обязательного пилотного контента. До продолжения фазы качества нужно закрыть следующие продуктовые пробелы:

- [x] готовый маршрут «Дроби» для Давида, 4 класс;
- [x] готовый маршрут «Обыкновенные дроби» для Сары, 6 класс;
- [x] отдельная входная мини-диагностика для обоих маршрутов, сохранённое evidence и рекомендуемый первый урок;
- [x] полный изолированный учебный цикл обоих профилей проверен HTTP-интеграционным тестом на PHP 8.3 и MySQL 8.4;
- [x] минимальный AI Gateway: серверная подсказка без готового ответа, локальный fallback и черновик теста с обязательным утверждением родителем;
- [x] ежедневный родительский AI-дайджест: число подсказок, уроки, вопросы ребёнка и нейтральный вопрос для разговора;
- [x] редактируемый родительский черновик следующего недельного плана: приоритет незавершённых и слабых тем, изменение дат и обязательности, удаление строк и отдельное подтверждение;
- [x] Playwright browser e2e для Сары и Давида: родительский вход и план, детский PIN, диагностика, урок, тест, домашняя работа, самооценка и принятие работы;
- [x] безвозвратное удаление профиля ребёнка, учебных данных и приватных файлов с точным подтверждением имени, паролем родителя и проверкой сохранности второго профиля;
- [x] MySQL backup и автоматическая проверка восстановления в отдельную временную базу со сравнением строк и контрольных сумм всех таблиц;
- [x] единые состояния загрузки, ошибок с повтором, содержательной пустоты, 404 и корневой React error boundary для основных кабинетов;
- [x] аудит доступности axe на ключевых экранах: skip-link, landmarks, клавиатурный фокус, контраст WCAG AA, подписи, группы состояний и живые уведомления;
- [x] адаптивные кабинеты на планшете 768×1024 и телефоне 390×844 с автоматической проверкой отсутствия горизонтального переполнения;
- [x] структурированные JSON-логи серверных ошибок с request ID и fingerprint без текста исключения, query-параметров и пользовательского содержимого;
- [x] единое автоматическое форматирование TypeScript, CSS, Markdown, JSON и PHP с проверкой в CI;
- [x] воспроизводимый production release для Beget со статическим frontend, PHP API, HTTPS/SPA rewrite и приватными `.env` и uploads;
- [x] создать технический сайт и MySQL в реальном аккаунте Beget, загрузить release и production-конфигурацию;
- [ ] устранить 403/нестабильную выдачу сайта, подтвердить HTTPS и пройти production smoke test.

Локальная production-подготовка завершена. Развёртывание на Beget начато, но пока не принято: технический домен после обновления возвращал 403, поэтому доступность frontend и API не подтверждена.

## Следующая задача

Восстановить корректную привязку technical domain к `public_html`, проверить права и логи Beget, затем подтвердить `/api/v1/health`, HTTPS и полный production smoke test по `docs/DEPLOY_BEGET.md`. После запуска установить Давиду полный КТП математики 4 класса из родительской страницы программы.
