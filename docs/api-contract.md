# HomeEdu API contract

Base URL: `/api/v1`. Формат запросов и ответов: JSON. Сессия передаётся в защищённой HttpOnly cookie.

## Общий формат ошибки

```json
{
  "error": {
    "code": "validation_error",
    "message": "Понятное описание ошибки"
  }
}
```

## Системные маршруты

| Метод | Маршрут | Доступ | Назначение |
|---|---|---|---|
| GET | `/health` | публичный | проверка API |
| POST | `/setup` | setup token, один раз | создание семьи и первого родителя |

`POST /setup` требует заголовок `X-Setup-Token`.

```json
{
  "familyName": "Наша семья",
  "displayName": "Родитель",
  "email": "parent@example.com",
  "password": "не менее 12 символов"
}
```

## Авторизация

| Метод | Маршрут | Назначение |
|---|---|---|
| POST | `/auth/parent/login` | вход родителя по email и паролю |
| POST | `/auth/student/login` | вход ребёнка по ID профиля и PIN |
| POST | `/auth/logout` | завершение текущей сессии |
| GET | `/me` | текущий пользователь или ребёнок |

## Профили детей

| Метод | Маршрут | Доступ | Назначение |
|---|---|---|---|
| GET | `/students` | родитель | список детей семьи |
| POST | `/students` | родитель | новый профиль ребёнка |
| PATCH | `/students/{id}/pin` | родитель | сменить PIN и закрыть детские сессии |

Пример создания ребёнка:

```json
{
  "displayName": "Сара",
  "grade": 6,
  "age": 12,
  "pin": "123456"
}
```

PIN принимается только как строка из 4–8 цифр и хранится исключительно как парольный хеш.

## Учебная программа

Все маршруты редактирования доступны только родителю и автоматически ограничены его `family_id`.

| Метод | Маршрут | Назначение |
|---|---|---|
| GET, POST | `/subjects` | список и создание предметов |
| PATCH, DELETE | `/subjects/{id}` | изменение и мягкое удаление предмета |
| POST | `/curricula` | создание программы ученика |
| GET | `/students/{id}/curricula` | программы выбранного ученика |
| GET | `/curricula/{id}` | полное дерево программы |
| POST | `/curricula/{id}/subjects` | назначение предмета программе |
| POST | `/curriculum-subjects/{id}/sections` | создание раздела |
| POST | `/sections/{id}/topics` | создание темы |
| POST | `/topics/{id}/lessons` | создание урока |
| PATCH, DELETE | `/sections/{id}` | изменение, порядок и мягкое удаление раздела |
| PATCH, DELETE | `/topics/{id}` | изменение, порядок и мягкое удаление темы |
| PATCH, DELETE | `/lessons/{id}` | изменение, порядок и мягкое удаление урока |

Пример создания программы:

```json
{
  "studentId": "uuid",
  "title": "6 класс",
  "schoolYear": "2026/2027"
}
```

При создании разделов, тем и уроков передаются `title`, необязательные `description`/`summary` и целочисленный `position`. Дерево `/curricula/{id}` возвращается уже отсортированным по `position`.

## Содержимое урока

| Метод | Маршрут | Назначение |
|---|---|---|
| GET | `/lessons/{id}/content` | урок и упорядоченные блоки |
| POST | `/lessons/{id}/blocks` | добавить блок |
| GET | `/student/lessons` | уроки текущего ученика с личным прогрессом |
| GET | `/student/lessons/{id}` | доступный ученику урок и его блоки |
| PATCH | `/student/lessons/{id}/progress` | сохранить позицию или завершение урока |
| GET | `/students/{id}/weekly-plan?weekStart=YYYY-MM-DD` | недельный план и доступные уроки |
| POST | `/students/{id}/plan-items` | назначить урок на день |
| DELETE | `/plan-items/{id}` | убрать назначение |
| GET | `/student/today` | назначенные текущему ученику уроки на сегодня |
| GET | `/student/mastery` | личная карта освоения тем и рекомендации повторения |
| GET | `/student/achievements` | личные достижения текущего ученика |
| POST | `/student/lessons/{id}/reflection` | сохранить самооценку завершённого урока |
| GET | `/students/{id}/progress-report` | родительский отчёт по назначениям и обратной связи |
| GET, POST | `/lessons/{id}/quizzes` | список и создание тестов урока |
| DELETE | `/quizzes/{id}` | удалить тест |
| POST | `/student/quizzes/{id}/attempts` | проверить ответ и сохранить попытку |
| GET, POST | `/lessons/{id}/homeworks` | список и создание открытых заданий |
| PUT | `/student/homeworks/{id}/submission` | сохранить черновик или отправить ответ |
| POST | `/student/homeworks/{id}/files` | прикрепить JPG, PNG или PDF к сохранённому черновику |
| GET | `/submission-files/{id}` | получить приватный файл с проверкой семейного доступа |
| DELETE | `/submission-files/{id}` | удалить свой файл до отправки работы |
| GET | `/review-submissions` | родительская очередь работ |
| POST | `/submissions/{id}/reviews` | принять работу или вернуть на доработку |
| PATCH | `/content-blocks/{id}` | изменить содержимое, тип или позицию |
| DELETE | `/content-blocks/{id}` | удалить блок |

Поддерживаемые типы первой версии: `markdown`, `example`, `link`, `video`, `image`. Текстовые блоки хранят `content.text`, медиа и ссылки — `content.url` и необязательный `content.caption`.

Типы тестовых вопросов: `single_choice`, `multiple_choice`, `number`, `short_text`. Ответы проверяются сервером; правильный ответ в ученический API не передаётся. Для числа родитель может задать допустимую погрешность, для короткого текста — несколько принимаемых формулировок.

При принятии домашней работы родитель может передать `independentExplanation: true`. Эта явная отметка выдаёт достижение за самостоятельное объяснение; автоматически по длине текста оно не присваивается. Карта освоения возвращает агрегаты `subjects`/`masterySubjects` и отдельные темы.
