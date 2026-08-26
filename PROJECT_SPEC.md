# Student Progress Tracker

## 1. Цель проекта

Создать веб-приложение для преподавателя английского языка для хранения и отслеживания прогресса учеников.

Это **первая часть будущей большой Teacher Platform**.

Сейчас нужно реализовать только модуль **Student Progress Tracker**, но архитектура проекта должна позволять в будущем добавить:

- календарь уроков;
- задачи;
- оплаты;
- материалы;
- библиотеку;
- социальные сети / content planner;
- личный прогресс преподавателя;
- AI-поиск;
- другие рабочие инструменты.

Не нужно реализовывать эти дополнительные модули сейчас.

Главная задача текущей версии — качественно реализовать:

**Groups → Students → Courses → Units → Progress → Goals → Teacher Notes**

---

# 2. Технологии

Использовать:

- HTML
- CSS
- JavaScript
- Firebase Authentication
- Firebase Cloud Firestore
- Firebase Web SDK
- GitHub / GitHub Pages для публикации

Проект должен работать как обычный frontend-проект без собственного backend-сервера.

---

# 3. Важный принцип разработки

Не начинать с визуала.

Порядок работы:

1. Проверить структуру проекта.
2. Настроить Firebase.
3. Проверить чтение данных из Firestore.
4. Проверить запись данных.
5. Реализовать Authentication.
6. Реализовать разграничение ролей.
7. Реализовать CRUD-функции админки.
8. Только после этого оформлять UI.

Не заменять данные Firebase мок-данными после подключения базы.

Firebase должен быть единственным источником данных приложения.

---

# 4. Структура проекта

Использовать понятную структуру файлов.

Пример:

```text
student-progress-tracker/
│
├── index.html
├── login.html
├── admin.html
├── student.html
│
├── css/
│   ├── styles.css
│   ├── admin.css
│   └── student.css
│
├── js/
│   ├── firebase-config.js
│   ├── auth.js
│   ├── admin.js
│   ├── students.js
│   ├── groups.js
│   ├── progress.js
│   ├── goals.js
│   └── student-view.js
│
├── assets/
│   ├── icons/
│   ├── images/
│   └── avatars/
│
└── PROJECT_SPEC.md
```

Структуру можно немного изменить, если это делает код чище.

Не складывать всю JavaScript-логику в один огромный файл.

---

# 5. Assets

Все готовые изображения хранить в папке:

```text
/assets
```

Использовать понятные названия файлов.

Например:

```text
student-avatar-alice.webp
achievement-star.webp
icon-progress.svg
```

Не использовать названия вроде:

```text
IMG234567.png
image1.png
final-final2.png
```

Иконки и изображения должны быть оптимизированы.

Мелкие иконки должны иметь небольшой размер и вес, чтобы сайт не становился тяжёлым.

---

# 6. Firebase

Проект уже создан в Firebase.

Используются:

- Firebase Authentication;
- Cloud Firestore.

Firebase configuration должна храниться в отдельном файле:

```text
js/firebase-config.js
```

Все остальные JS-файлы должны импортировать Firebase configuration из этого файла.

Не дублировать firebaseConfig в разных файлах.

---

# 7. Authentication

Использовать Firebase Authentication.

Метод входа:

```text
Email + Password
```

В проекте есть администратор / преподаватель.

Для администратора уже существует Firebase Authentication user.

Его UID необходимо использовать при проверке доступа.

---

# 8. Роли пользователей

Предусмотреть минимум две роли:

```text
admin
student
```

Документы пользователей хранятся:

```text
users/{uid}
```

Пример документа администратора:

```text
users/
  ADMIN_UID/
    name: "Sasha"
    email: "..."
    role: "admin"
```

---

# 9. Критически важное правило безопасности

Ученик не должен:

- видеть кнопку Admin;
- видеть ссылку на Admin Panel;
- видеть Teacher Dashboard;
- читать teacherNotes;
- редактировать progress;
- видеть других учеников;
- видеть внутренние данные преподавателя.

Кнопка Admin **вообще не должна отображаться** в student UI.

Но скрытия кнопки недостаточно.

Даже если ученик вручную введёт URL:

```text
/admin.html
```

приложение должно проверить Authentication и роль пользователя.

Если пользователь не admin:

```text
redirect → login/student page
```

---

# 10. Firestore Security

Не полагаться только на frontend.

Настроить Firestore Security Rules.

Admin должен иметь доступ на чтение и запись необходимых данных.

Student должен иметь доступ только к разрешённым данным своего профиля.

`teacherNotes` должны быть полностью недоступны student role.

При необходимости предусмотреть связь:

```text
users/{uid}.studentId
```

или:

```text
students/{studentId}.loginUid
```

для будущих student accounts.

В первой версии student authentication можно подготовить архитектурно, даже если student accounts ещё не созданы.

---

# 11. Существующая структура Firestore

В базе уже существуют коллекции:

```text
users
groups
students
courses
units
progress
goals
teacherNotes
```

Не переименовывать существующие коллекции без необходимости.

---

# 12. users

Структура:

```text
users/{uid}
```

Поля:

```text
name: string
email: string
role: string
```

В будущем для student user можно добавить:

```text
studentId: string
```

---

# 13. groups

Структура:

```text
groups/{groupId}
```

Поля:

```text
name: string
courseId: string
academicYear: string
active: boolean
```

Пример:

```text
name: "Alice and Artyom"
courseId: "project-explore-1"
academicYear: "2026-2027"
active: true
```

---

# 14. courses

Структура:

```text
courses/{courseId}
```

Пример Document ID:

```text
project-explore-1
```

Поля:

```text
name: string
level: string
active: boolean
```

Пример:

```text
name: "Project Explore 1"
level: "A1"
active: true
```

---

# 15. students

Структура:

```text
students/{studentId}
```

Поля:

```text
name: string
groupId: string
courseId: string
color: string
active: boolean
```

В будущем можно добавить:

```text
avatar: string
loginUid: string
status: string
```

Возможные значения status:

```text
active
paused
archived
```

Каждый ученик должен иметь свой постоянный `color`.

Этот цвет позже будет использоваться также в будущем календаре Teacher Dashboard.

---

# 16. units

Структура:

```text
units/{unitId}
```

Поля:

```text
courseId: string
number: integer
title: string
order: integer
active: boolean
```

Пример:

```text
courseId: "project-explore-1"
number: 1
title: "Unit 1"
order: 1
active: true
```

Юниты должны сортироваться по полю:

```text
order
```

---

# 17. Physical and learning progress (current model)

The application has two separate progress layers. Physical course progress is the only layer allowed to show a percentage: `completed lessons / total lessons in the current unit × 100`. Each group and student stores its current physical snapshot in `courseJourney`, including `unitId`, `completedLessonIds`, `currentLessonId` and safe `lessonStops`. Master lesson setup status is not learner progress.

Learning progress uses specific learning targets defined in each unit. `units/{unitId}.objectives` is an ordered array of stable `{ id, category, categories[], title, order }` objects. Categories are Vocabulary, Grammar, Reading, Listening, Speaking and Writing. Writing is included only in units where Writing objectives are configured. One target may belong to several skill areas but is assessed once by stable ID.

Current status records are stored in `objectiveProgress`, lesson update records in `progressHistory`, and homework in `homeworkAssignments`. Teacher-selectable objective statuses are `needs_practice`, `developing` and `confident`; an absent record is displayed as Not assessed/`—`. Aggregates use assessed objectives only and display status labels rather than percentages. An admin may edit or delete a lesson update from the Student Profile; the application then recalculates affected objective snapshots and physical lesson completion from the remaining history. Private observations and published feedback remain independent records and are never silently deleted with progress.

Homework is a separate Learning habits area with `assigned`, `completed` and `needs_completion` statuses. It is not a language skill and does not contribute to language progress calculations.

The previous `progress` percentage documents described below are legacy read-only compatibility data. New UI writes must not add to them or mix them into current calculations.

The shared Course Journey map displays physical completed/current/upcoming lesson stops for students and groups. Group Quick Update pre-fills the selected lesson's one-to-three real learning targets, applies common statuses and permits per-student overrides before publishing. See `docs/physical-and-learning-progress-spec.md`.

## 17.1 Legacy percentage schema (read-only compatibility)

Структура:

```text
progress/{progressId}
```

Один progress document относится к:

```text
ONE STUDENT + ONE UNIT
```

Поля:

```text
studentId: string
unitId: string

vocabulary: integer
grammar: integer
reading: integer
listening: integer
speaking: integer
homework: integer

unitProgress: integer
```

Дополнительно можно использовать:

```text
updatedAt: timestamp
```

Skills в первой версии фиксированные:

- Vocabulary
- Grammar
- Reading
- Listening
- Speaking
- Homework

Не создавать отдельную коллекцию skills в MVP.

---

# 18. Legacy Unit Progress (read-only compatibility)

`unitProgress` должен рассчитываться автоматически на основе skill scores.

Например:

```text
Vocabulary: 75
Grammar: 50
Reading: 100
Listening: 75
Speaking: 75
Homework: 100
```

Среднее значение:

```text
79
```

Не заставлять преподавателя вручную рассчитывать unitProgress.

При сохранении progress:

1. получить значения skills;
2. рассчитать среднее;
3. сохранить результат в unitProgress.

---

# 19. Goals

Структура:

```text
goals/{goalId}
```

Поля:

```text
studentId: string
title: string
status: string
studentVisible: boolean
createdAt: timestamp
```

В будущем:

```text
completedAt: timestamp
```

Статусы:

```text
new
working
confident
completed
```

Пример:

```text
title: "Use new vocabulary without prompts"
status: "working"
studentVisible: true
```

---

# 20. Teacher Notes

Teacher Notes — приватная информация преподавателя.

Структура:

```text
teacherNotes/{noteId}
```

Поля:

```text
studentId: string
unitId: string
category: string
text: string
createdAt: timestamp
```

Пример:

```text
category: "speaking"

text:
"Uses the target vocabulary confidently with picture prompts but still needs support to use it spontaneously."
```

Teacher Notes:

```text
ADMIN ONLY
```

Student никогда не должен иметь доступ к этой коллекции.

---

# 21. Педагогическая логика Teacher Notes

Teacher Notes не должны дублировать проценты.

Плохой вариант:

```text
Vocabulary is weak.
```

если и так видно:

```text
Vocabulary: 50%
```

Teacher Notes должны описывать причину, закономерность или следующий педагогический шаг.

Например:

```text
Recognises the vocabulary confidently but needs picture prompts to use it spontaneously.
```

или:

```text
Uses Present Simple confidently in statements but often drops does/doesn't in questions.
```

или:

```text
Speaks willingly but tends to give one-sentence answers. Encourage extending answers with because, but and so.
```

---

# 22. Achievements

Подготовить архитектуру для коллекции:

```text
achievements
```

Даже если она будет реализована после основной части.

Пример:

```text
achievements/{achievementId}
```

Поля:

```text
studentId: string
type: string
title: string
description: string
icon: string
earnedAt: timestamp
```

Пример:

```text
type: "badge"
title: "Vocabulary Star"
description: "100% vocabulary in 3 units"
icon: "achievement-star.webp"
```

---

# 23. Login screen

Создать аккуратный login screen.

Поля:

```text
Email
Password
```

Кнопка:

```text
Sign in
```

После входа проверить:

```text
users/{uid}.role
```

Если:

```text
role === "admin"
```

→ открыть Teacher Dashboard.

Если:

```text
role === "student"
```

→ открыть Student View.

---

# 24. Teacher Dashboard

Главная закрытая страница администратора.

Должна содержать:

## Overview

Например:

```text
Active Students
Groups
Courses
Students needing attention
```

Не перегружать dashboard статистикой.

---

# 25. Groups section

Показывать список групп.

Карточка группы:

```text
Group Name
Course
Number of students
```

Например:

```text
Alice and Artyom
Project Explore 1
2 students
```

При клике открывается группа.

---

# 26. Group page

На странице группы показать:

```text
Group name
Course
Academic year
Students
```

Для каждого ученика:

- имя;
- его цвет;
- краткий progress;
- кнопка открыть student profile.

Admin actions:

```text
Add student
Edit group
Archive group
```

---

# 27. Students section

Добавить общий список учеников.

Добавить search.

Поиск должен работать минимум по:

```text
student name
group
course
```

---

# 28. Add Student

В Teacher Dashboard должна быть кнопка:

```text
+ Add Student
```

При клике открыть форму.

Поля:

```text
Name
Group
Course
Color
Status
```

После Save новый документ должен автоматически появляться:

```text
students/{studentId}
```

Admin не должен вручную добавлять студентов через Firebase Console после запуска приложения.

---

# 29. Edit Student

Добавить возможность:

```text
Edit Student
```

Можно редактировать:

- name;
- group;
- course;
- color;
- status.

---

# 30. Add Group

Admin должен иметь возможность добавить группу через интерфейс.

Поля:

```text
Group name
Course
Academic year
Active
```

---

# 31. Add Course

Предусмотреть возможность добавлять курсы через админку.

Поля:

```text
Course name
Level
Active
```

---

# 32. Add Unit

Admin должен иметь возможность добавить unit.

Поля:

```text
Course
Unit number
Unit title
Order
Active
```

---

# 33. Student page — Teacher View

Это основной рабочий экран преподавателя.

Верхняя часть:

```text
Student Name
Group
Course
Student color
```

Также показать:

```text
Overall Progress
Strongest Area
Current Focus
```

---

# 33.1 Current learning-objective UI (supersedes sections 34–38)

The Admin Student Profile and student-facing My Progress page show expandable unit cards. Inside each unit, objectives are grouped by the categories configured for that unit and each objective displays one of the four approved status badges. Categories with no objectives are omitted, so Writing appears only where it is taught.

Quick Update lists the selected unit's concrete objectives. The teacher explicitly ticks only objectives assessed in that lesson and selects a status; unticked objectives remain unchanged. The same update can create or update separate Homework/Learning habits records and can save an optional private teacher observation.

Overall Status and Strongest Area are derived from assessed objective statuses only. The current UI must not render percentage bars or combine legacy percentage documents with objective statuses.

# 34. Legacy Progress Matrix (superseded by section 33.1)

Главный элемент страницы.

Формат:

| Skill | Unit 1 | Unit 2 | Unit 3 |
|---|---:|---:|---:|
| Vocabulary | 75% | 100% | 50% |
| Grammar | 50% | 75% | 75% |
| Reading | 100% | 75% | 100% |
| Listening | 75% | 100% | 75% |
| Speaking | 75% | 75% | 100% |
| Homework | 100% | 75% | 100% |

Skills расположены вертикально.

Units расположены горизонтально.

Это важный визуальный принцип проекта.

---

# 35. Legacy Unit details (superseded by section 33.1)

При клике на Unit открыть подробную карточку или modal.

Показать:

```text
Unit title
Vocabulary
Grammar
Reading
Listening
Speaking
Homework
Unit Progress
```

Добавить:

```text
Edit Progress
```

---

# 36. Legacy Edit Progress (superseded by section 33.1)

Admin выбирает / редактирует:

```text
Vocabulary
Grammar
Reading
Listening
Speaking
Homework
```

Можно использовать:

- sliders;
- number inputs;
- удобные progress controls.

После Save:

1. обновить Firestore;
2. пересчитать unitProgress;
3. обновить таблицу без перезагрузки страницы, если возможно.

---

# 37. Legacy Overall Progress (superseded by section 33.1)

Overall Progress ученика рассчитывать автоматически на основе существующих progress documents.

Не хранить его вручную, если нет необходимости.

---

# 38. Legacy Strongest Area (superseded by section 33.1)

Strongest Area определить автоматически на основе средних значений skills по всем units.

Например:

```text
Speaking — 91%
```

Не использовать teacherNotes для этого расчёта.

---

# 39. Current Focus

Current Focus брать из активной цели ученика.

Например:

```text
Use new vocabulary without prompts
```

Статус:

```text
Working on it
```

---

# 40. Goals section

На student profile показать:

```text
Current Goals
Completed Goals
```

Admin может:

- Add goal;
- Edit goal;
- Change status;
- Delete goal;
- Mark completed;
- Change studentVisible.

---

# 41. Teacher Observations

Отдельный блок:

```text
Teacher Observations
```

Показывать только admin.

Для каждой заметки:

```text
Date
Unit
Category
Observation
```

Admin может:

```text
Add note
Edit note
Delete note
```

---

# 42. Student View

Student View должен быть визуально проще и дружелюбнее Teacher View.

Student видит:

- своё имя;
- курс;
- progress;
- units;
- skill progress;
- unit progress;
- current goal;
- student-visible goals;
- achievements;
- gamification.

Student не видит:

- teacherNotes;
- admin controls;
- Firebase IDs;
- других students;
- внутренние teacher data.

---

# 43. Student Learning Objectives (current model)

The student sees expandable unit cards containing the same teacher-defined objective descriptions and student-safe status badges. The page shows category and unit status summaries, never manually entered percentages. Homework is shown at the bottom of each unit as a separate Learning habits block, including completed count among assigned homework only.

The matrix guidance below is retained only as a legacy visual reference and must not override the current objective-based model.

Можно использовать ту же структуру:

```text
Skills × Units
```

но сделать её визуально более дружелюбной.

Например:

```text
progress bars
stars
levels
badges
```

Не превращать progress в детский интерфейс автоматически.

Стиль должен быть универсальным и подходить и детям, и взрослым студентам.

---

# 44. Gamification

Не делать сложную игровую систему в первой реализации.

Подготовить место для:

```text
Achievements
Badges
Completed goals
```

Позже можно добавить:

```text
Points
Levels
Streaks
Rewards
```

---

# 45. Admin navigation

Пример sidebar:

```text
Dashboard
Groups
Students
Courses
```

Позже здесь появятся:

```text
Calendar
Tasks
Payments
Materials
Content
My Learning
```

Не реализовывать их сейчас.

Можно показать disabled / coming later только если это не перегружает интерфейс.

Лучше вообще пока их не показывать.

---

# 46. Student navigation

Student navigation должна быть отдельной.

Например:

```text
My Progress
My Goals
Achievements
```

Не использовать admin sidebar.

---

# 47. Responsive design

Интерфейс должен нормально работать:

- desktop;
- laptop;
- tablet.

Основной приоритет — desktop/laptop.

Progress Matrix при большом количестве units должна иметь горизонтальный scroll, а не ломать layout.

---

# 48. Визуальный стиль

Не делать плоский скучный административный интерфейс.

Желательно:

- clean;
- modern;
- soft;
- friendly;
- spacious;
- professional;
- rounded cards;
- clear hierarchy;
- pleasant typography.

Не использовать emoji как основные иконки интерфейса.

Использовать лёгкие SVG/icons или изображения из assets.

---

# 49. Цвета учеников

Каждый student имеет поле:

```text
color
```

Использовать его:

- рядом с именем;
- на карточке student;
- в group view;
- в будущем — в calendar.

При добавлении нового ученика admin должен выбирать цвет.

---

# 50. Future Calendar Compatibility

Календарь сейчас не реализовывать.

Но student `color` должен быть сохранён так, чтобы позже calendar event мог использовать тот же цвет.

Будущий calendar должен позволять визуально различать учеников по постоянным цветам.

---

# 51. Future Teacher Platform

Архитектура должна позволять позже добавить коллекции:

```text
lessons
payments
tasks
calendarEvents
materials
contentIdeas
```

Не создавать сложную реализацию этих модулей сейчас.

---

# 52. Future Materials Library

В будущем проект может иметь внешний Materials Hub.

Возможные категории:

```text
Free Materials
Worksheets
Games
Courses
Library
```

Также в будущем возможен AI-search по материалам.

Не реализовывать сейчас.

---

# 53. Future AI Search

Позже может появиться функция:

```text
Ask AI
```

Примеры запросов:

```text
Find me a warm-up for Present Perfect B1.
```

```text
What did I work on with Alice during the last lessons?
```

```text
Which students currently need speaking practice?
```

Архитектура текущего проекта не должна мешать добавлению этой функции.

---

# 54. Future Miro / Embed

Некоторые отдельные tools и interactive widgets в будущем могут быть опубликованы отдельно и встроены в Miro через iframe/embed.

Текущий Student Progress Tracker не обязан быть Miro widget.

---

# 55. CRUD

Admin должен иметь CRUD-интерфейс минимум для:

```text
students
groups
courses
units
progress
goals
teacherNotes
```

CRUD означает:

```text
Create
Read
Update
Delete
```

При удалении важных данных добавить confirmation dialog.

Например:

```text
Are you sure you want to delete this student?
```

---

# 56. Не использовать hardcoded students

После подключения Firestore нельзя оставлять:

```js
const students = [...]
```

как основной источник данных.

Students должны загружаться из Firestore.

То же относится к:

- groups;
- courses;
- units;
- progress;
- goals;
- teacherNotes.

---

# 57. Loading states

Добавить понятные состояния:

```text
Loading...
No students yet
No progress yet
No goals yet
No teacher observations yet
```

Не показывать пустые сломанные блоки.

---

# 58. Error handling

Обрабатывать Firebase errors.

Например:

```text
Unable to load students.
Please try again.
```

Ошибки писать также в console для разработки.

---

# 59. Validation

Проверять формы.

Например:

Student name не может быть пустым.

Progress:

```text
0–100
```

Unit number:

```text
positive integer
```

---

# 60. Timestamps

Для новых:

- teacher notes;
- goals;
- progress updates;

использовать Firebase timestamps / serverTimestamp там, где это уместно.

---

# 61. Security before design

Перед финальной визуальной доработкой проверить:

- admin login;
- logout;
- redirect;
- protected admin page;
- student role;
- Firestore rules;
- teacherNotes protection.

---

# 62. Этапы реализации

## Phase 1 — Firebase connection

- подключить Firebase;
- создать firebase-config.js;
- проверить Firestore;
- проверить Authentication.

## Phase 2 — Authentication

- login;
- logout;
- role detection;
- admin route protection.

## Phase 3 — Admin data

- groups;
- courses;
- students;
- units.

## Phase 4 — Student profile

- progress;
- matrix;
- unit details.

## Phase 5 — Goals and notes

- goals;
- teacherNotes;
- current focus.

## Phase 6 — Student View

- безопасный student-facing interface;
- student-visible data only.

## Phase 7 — Gamification

- achievements;
- badges placeholder / basic version.

## Phase 8 — UI polish

- final styling;
- responsive layout;
- assets optimization.

---

# 63. GitHub

Готовый проект будет опубликован на GitHub.

Проект должен быть совместим с GitHub Pages.

Не использовать абсолютные локальные пути.

Плохо:

```text
C:\Users\...
```

Хорошо:

```text
./assets/icons/progress.svg
```

---

# 64. Важно про firebase-config.js

Проект использует frontend Firebase configuration.

Не помещать туда:

- admin SDK private keys;
- service account JSON;
- пароли;
- приватные секреты.

Никогда не добавлять service-account credentials в GitHub.

Безопасность Firestore должна обеспечиваться Authentication + Firestore Security Rules.

---

# 65. Код

Код должен быть:

- понятным;
- разделённым по функциям;
- без гигантских файлов;
- с понятными именами переменных;
- без ненужной сложности.

Добавлять комментарии только там, где они действительно помогают понять логику.

---

# 66. Перед изменением архитектуры

Если существующая структура Firebase отличается от ожидаемой:

**не удалять и не переделывать существующую базу автоматически.**

Сначала:

1. проанализировать текущую структуру;
2. сохранить совместимость;
3. предложить минимальные изменения.

---

# 67. Основной пользовательский сценарий Admin

```text
Login
↓
Teacher Dashboard
↓
Choose Group
↓
Choose Student
↓
View Progress
↓
Open Unit
↓
Update Skills
↓
Save
↓
Progress recalculates
↓
Add Goal / Observation
```

---

# 68. Основной пользовательский сценарий Student

```text
Login
↓
My Progress
↓
View Units
↓
View Skills
↓
See Current Goal
↓
See Achievements
```

Student не должен видеть внутренний teacher workflow.

---

# 69. MVP Definition of Done

Первая версия считается готовой, когда:

- Firebase подключён;
- admin может войти;
- admin page защищена;
- groups загружаются из Firestore;
- students загружаются из Firestore;
- можно добавить student через UI;
- можно изменить student;
- можно открыть student profile;
- units загружаются;
- progress matrix формируется из Firestore;
- progress можно изменить через UI;
- unitProgress рассчитывается;
- можно создавать goals;
- можно создавать teacherNotes;
- teacherNotes доступны только admin;
- student-facing интерфейс не показывает приватные данные;
- приложение работает после публикации на GitHub Pages.

---

# 70. Главный принцип проекта

Это не одноразовый учебный сайт.

Student Progress Tracker должен стать первым модулем будущей единой системы преподавателя.

Поэтому:

**не переусложнять MVP, но не создавать архитектурных тупиков, которые потребуют полностью переписывать проект при добавлении новых модулей.**
