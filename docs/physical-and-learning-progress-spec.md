# Physical and Learning Progress

## Product boundary

The dashboard is a progress system, not a textbook or vocabulary archive. The reusable curriculum hierarchy is:

```text
Course → Unit → Lesson → Learning Target
```

Courses keep a title, level and short description/goal. Units keep a title, main goal, a small set of outcomes and an optional final outcome. Lessons keep a title, one to three linked learning targets and skill tags. Vocabulary may be mentioned inside a target or observation, but long vocabulary catalogs are managed externally in Miro and are not required by the platform.

## Two independent progress models

### Physical progress

Physical progress answers where a learner or group is in the programme. It is the only progress model that displays a percentage:

```text
completed lessons / total lessons in the current unit × 100
```

The shared calculation in `js/domain/physical-progress.js` derives completed, current and upcoming lesson stops. It never reads objective status or mastery data.

The current snapshot is stored on the relevant group or student document as `courseJourney`:

```text
courseId
unitId
completedLessonIds[]
currentLessonId
lessonStops[]
updatedAt
```

`lessonStops` is a safe student-readable snapshot containing only lesson ID, number/order, title, skill tags and up to three public learning-target snapshots. It must never contain private teacher notes, activities, resources or observations. Group publication writes the group journey and an independent copy on every included student, so an individual can later diverge without changing the group.

The same safe projection is maintained as `units/{unitId}.lessonStops` when a course program is installed or an admin saves/deletes a lesson. This lets a student see real lesson titles before the first progress publication without granting access to private `lessons` documents. Once a journey is published, its independent snapshot preserves the learner's current path.

### Learning progress

Learning progress answers how a learner is doing on real learning targets. It never displays a percentage. The only current statuses are:

- Needs practice (`needs_practice`)
- Developing (`developing`)
- Confident (`confident`)
- Not assessed (`not_assessed`, storage/teacher fallback only)

Targets have stable IDs and teacher-readable names. One target may have a primary `category` and additional `categories`; all categories come from Vocabulary, Grammar, Reading, Listening, Speaking and Writing. Student UI must display the real target name, not only a generic category.

## Shared Course Journey component

`js/ui/course-journey-map.js` renders the same component in Student Dashboard and Group Details. It receives a unit, journey snapshot, optional admin-readable lesson records and theme.

- `child`: playful trail treatment based on `course.journey.child.png`.
- `teen` and `adult`: one calmer visual family based on `course.journey.adult..png`.
- the component logic and DOM structure are shared.

The component shows the current unit, completed lesson count, physical percentage and compact completed/current/upcoming stops. It is responsive and does not create page-level horizontal overflow.

Group Details also lists the current lesson's real targets. Each target badge aggregates the member students' existing objective statuses into a status label; it never turns the result into a percentage.

## Teacher publishing workflow

The primary workflow is:

```text
Open lesson → Update progress → Save update
```

Opening Update progress from Lesson Details routes to a matching group. Group Quick Update preselects the current unit and lesson and loads that lesson's targets. The teacher can:

1. select only the targets actually worked on, without assigning a status;
2. optionally set common statuses for selected targets;
3. add and persist an unplanned target without leaving the update;
4. include or exclude students;
5. override any selected target for an individual student;
6. optionally update homework, goal, private observation or explicitly published feedback;
7. mark the lesson physically complete and save.

Saving updates the group's journey, each included student's journey, current objective records and progress history. `workedOnObjectives` are stored separately from assessed status changes. Individual Quick Update uses the same unit/lesson/target and physical-progress logic.

## Revising a published lesson update

Admin Student Profile exposes every available `progressHistory` entry as a Progress Update with an explicit `Edit progress` action. The teacher can change its lesson date, assessed target statuses and physical lesson-completion action, or delete the update entirely. Saving or deleting recalculates affected `objectiveProgress` documents from the remaining ordered history and recalculates the selected lesson in the student's current `courseJourney`.

Progress revision is intentionally separate from other lesson records: teacher observations remain private and independent, while published feedback remains an immutable student-facing version. Deleting a progress update therefore never silently deletes an observation, homework assignment or published feedback. Legacy history entries can still revise their learning-target changes; when they lack explicit physical metadata, the current lesson state is used in the editor and deletion falls back to the state before that legacy entry where available.

## Observations and feedback

Observations remain teacher-only. New observations may store `groupId`, `courseId`, `unitId`, `lessonId`, learning-target ID/title, category, lesson date/context and observation text. `includeInFeedback` only selects a private source for draft generation. Students can read only their own separately published feedback versions.

## Vocabulary migration

New course-program installation does not write long vocabulary lists. Vocabulary editors and catalog views are removed from the active course/lesson workflow. The Courses screen exposes an explicit, confirmed `Remove stored vocabulary` action that clears legacy arrays from units and lessons without changing learning targets, observations, progress or resources. No destructive cleanup runs automatically.

## Security

No new collection or broader rule is required. Admins already own writes to groups, students, lessons, objective progress, history and teacher notes. A student reads only their own student document and permitted learning collections. Because student-facing journey data is copied into the student's own document, lesson-planning documents and teacher notes remain private.

## Acceptance checks

1. Physical percentage changes only when a lesson ID becomes completed.
2. Target status changes do not change the physical percentage.
3. Group publication advances the group and included students.
4. An individual override does not change another student.
5. Student Current Learning displays real target names and status badges without percentages.
6. Child and teen/adult journey variants use one renderer.
7. Observation text never appears in `courseJourney` or student-readable lesson snapshots.
8. Existing feedback, homework and objective history workflows remain operational.
9. Editing or deleting a Progress Update recalculates only the affected student's current learning and physical progress.
