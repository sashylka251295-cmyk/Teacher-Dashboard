# Teacher Dashboard — Master Context

_Last updated: 17 August 2026_

## 1. Project purpose

Build a personal digital system for an online English teacher: **Teacher Dashboard**.

The system should become the teacher’s central workspace for:

- students and groups;
- courses and course progress;
- lesson / teacher observations;
- payments;
- calendar;
- separate To‑Do / task management;
- materials library;
- social media planning;
- gamification;
- the teacher’s own learning;
- AI search across the teacher’s own knowledge base and materials.

The system is primarily a **private teacher/admin workspace**. Students should have access only to their own student-facing progress/gamification area, not to the teacher dashboard.

---

## 2. Core product principle

The system should not be just a collection of pages. It should gradually become the teacher’s **central operating system** for teaching work.

The workflow is:

**plan → database → visual/UI → implementation → GitHub/deployment**

For major features, keep a clear `.md` specification in the project so Codex / AI can work from an explicit source of truth.

---

## 3. Roles and access

### Admin / Teacher

The teacher is the admin.

Teacher access includes:

- all students;
- all groups;
- all courses;
- all progress data;
- teacher observations;
- payments;
- calendar;
- tasks;
- materials;
- social media planning;
- gamification controls;
- teacher’s own learning module.

The teacher dashboard should be a **protected route**.

The admin button / admin interface should not be visible to students.

### Student

Student users should only have access to their own relevant data.

Student-facing area can include:

- own progress;
- course/unit progress;
- gamification elements;
- potentially badges/rewards.

Students must not be able to access other students’ data or teacher-only information.

---

## 4. Firebase / data architecture

Firebase has already been selected.

### Current setup

- Firebase account created.
- Firestore selected.
- Firebase CLI installed.
- Emulator Suite installed.
- Emulator UI has been opened successfully.
- Development is on Windows.
- Node version used: `v24.19.0`.
- PowerShell blocked normal `npm`; `npm.cmd` was used successfully.
- Firebase login completed.

### Collections already discussed / used

- `users`
- `groups`
- `students`
- teacher observations collection is present

### Existing security rules concepts

The rules/work already referenced these helper concepts:

- `isSignedIn`
- `currentUser` → `users/{uid}`
- `isAdmin` → role == `admin`
- `isStudent` → role == `student`
- `currentStudentId`
- `isOwnStudent`
- `currentStudentCourseId` → `students/{id}.courseId`

Important: continue to build rules around **role-based access** and student ownership.

The teacher/admin UID should be stored/used appropriately in the project/rules.

---

## 5. Authentication

There is already a login flow concept:

**sign in → session → protected dashboard**

Earlier issue:
- opening pages directly through `file:///` was incorrect;
- development moved to Live Server / Firebase Emulator.

Admin and student users have already been created during testing.

---

## 6. Main data hierarchy

Core hierarchy:

**Groups → Students → Student Page**

A student should be linked to a course.

A student record may include:

- name;
- avatar/photo;
- group;
- course;
- current unit;
- progress;
- goals;
- strengths;
- weaknesses;
- teacher notes;
- other profile information added later.

---

## 7. Student progress model

The product keeps two explicitly separate progress models. **Physical progress** shows where a student or group is in the programme and may use `completed lessons / total lessons × 100`. **Learning progress** shows how a student is doing on specific learning targets and never uses percentages. Full implementation details are in `docs/physical-and-learning-progress-spec.md`.

### Physical course progress

Physical progress uses the hierarchy `Course → Unit → Lesson` and the `courseJourney` snapshot on each group/student document. The snapshot stores the current unit, completed lesson IDs, current lesson and safe lesson-stop metadata. The shared Course Journey component renders completed/current/upcoming lesson stops in Student Dashboard and Group Details. Child and teen/adult themes share the same renderer; live HTML nodes are composed over separate reference-derived child trail and teen/adult roadmap assets.

Only publishing a lesson completion changes this percentage. Objective statuses, homework and teacher observations never change it.

`students/{studentId}.unitJourneys.{unitId}` preserves physical snapshots for earlier units while `courseJourney` identifies the current unit. The teacher may explicitly mark an entire historical unit 100% complete without adding mastery statuses. Manual completion is reversible and never deletes real lesson-update history.

Group Details includes a real-data Group Activity workspace for previous progress updates, feedback and homework. Shared updates are grouped by lesson/date while retaining each student's individual result. Existing homework shown in the admin Student Profile has a full Edit action for title, instructions, due date, status and safe PDF/web resources; editing homework does not create or change learning progress. See `docs/group-activity-and-homework-editing-spec.md`.

In both the admin Student Profile and the student-facing My Progress page, each Unit row in Learning Objectives is an expandable control. Opening it shows the shared themed Course Journey map before the Unit's target details, including completed, current and upcoming lesson stops plus the physical completion count and percentage. A Unit with no journey snapshot shows all stops as upcoming rather than inventing a current position. Students use only public Unit lesson stops and their own journey snapshot; teacher-only Lesson documents remain inaccessible.

### Learning progress

Learning progress is structured by **specific learning targets**, not by manually entered percentages.

### Language skill categories

- Vocabulary
- Grammar
- Reading
- Listening
- Speaking
- Writing

Each unit contains only the categories and objectives that are actually taught in that unit. Writing is a full language category and appears only when the teacher adds one or more Writing objectives to the unit. Every objective has a stable ID and a teacher-written description, for example `Write sentences using Present Continuous`. A target can belong to several skill areas through `categories[]` while retaining one primary `category` for compatibility.

### Objective statuses

- Needs practice (`needs_practice`)
- Developing (`developing`)
- Confident (`confident`)
- Not assessed is an absence/fallback state (`not_assessed`, or no current status record), not a teacher-selected assessment result.

Quick Update pre-fills a lesson's real objectives but leaves them unselected. The teacher selects only what was actually worked on; status is optional and is never pre-filled as Developing. A target selected without status is saved as lesson focus without creating an assessed status. `+ Add learning objective` creates a stable Unit objective and links it to the current Lesson without leaving the update. Group Quick Update applies the shared selection to included students and opens individual cards only for optional exceptions or feedback. Each update creates an admin-only history record that can later be edited or deleted with automatic recalculation.

### Calculated summaries

Needs practice, Developing and Confident map internally to 1, 2 and 3. Category and unit summaries average only assessed objectives and round to the nearest status. Not assessed objectives are excluded. If nothing has been assessed, the summary is `—` / Not assessed. The interface shows status labels and badges, not percentages.

### Learning habits — Homework

Homework is not a language skill and is never included in language-category or overall learning-status calculations. It is stored and displayed as a separate Learning habits block. A lesson defaults to no homework. When homework is assigned, its status is one of Assigned, Completed or Needs completion. Completion summaries use assigned homework only; no homework does not lower progress.

Homework assignments can include full student-facing instructions, an optional due date and safe PDF/web resources. The Student Dashboard card and sidebar open a dedicated Homework page where each real assignment expands inline. Resources accept HTTPS links or public repository PDFs under `assets/materials/homework/`; runtime file upload is not supported because the project intentionally avoids Firebase Storage and Blaze. See `docs/homework-details-spec.md`.

### Compatibility

The old `progress` percentage documents are legacy read-only data. They are preserved for migration but are not mixed into objective-based status calculations or the current UI.

### Implemented Firestore model

- `units/{unitId}.objectives`: ordered array of `{ id, category, categories[], title, order }`; IDs remain stable while descriptions, skill associations and order are edited.
- `groups/{groupId}.courseJourney` and `students/{studentId}.courseJourney`: current physical-progress snapshots with completed/current lesson IDs and safe lesson stops.
- `students/{studentId}.unitJourneys.{unitId}`: per-unit physical snapshots, including an explicit reversible `completedManually` marker when the teacher records a previously finished unit.
- `objectiveProgress/{studentId__unitId__objectiveId}`: current `{ studentId, courseId, unitId, objectiveId, category, status, updatedAt }`.
- `progressHistory/{historyId}`: admin-only lesson update containing the student/unit/lesson, lesson date, changed objective statuses and physical completion action. New records also keep the previous physical state needed for safe revision. An admin can edit or delete an update; affected `objectiveProgress` and the student's current `courseJourney` are recalculated without deleting separate observations or feedback.
- `homeworkAssignments/{assignmentId}`: separate `{ studentId, courseId, unitId, lessonId, title, description, dueDate, resources, status, lessonDate, createdAt, updatedAt }` record.

Admins can write these records. A student can read only their own `objectiveProgress` and `homeworkAssignments`, plus the units of their assigned course. Students cannot write learning data and cannot read `progressHistory` or `teacherNotes`.

### Migration note

Existing percentage documents remain in `progress` and are not changed or deleted automatically. New Quick Update writes only the objective-based collections above. Existing units can be migrated safely by adding objective definitions in Unit Editor and then assessing them through Quick Update. Legacy percentages remain available for a future explicit conversion/audit, but there is deliberately no automatic percentage-to-status conversion because a percentage cannot identify the specific learning objective it assessed.

---

## 8. Student page

The Student Page should eventually include:

### Profile

- student photo/avatar;
- name;
- group;
- course;
- relevant status/info.

### Progress

- physical current unit, current lesson and completed lesson count;
- physical Course Journey percentage;
- current real learning-target names and status badges;
- skill/category summaries expressed as statuses, not mastery percentages.

### Teacher knowledge

- teacher notes;
- current goals;
- strong sides;
- weak sides;
- observations/history.

The page should allow the teacher to understand the student quickly without searching across different systems.

Student-facing components use one shared theme architecture with `child`, `teen` and `adult` variants. Teen and adult belong to the same restrained visual family; `neutral` remains a legacy alias for existing records. Components and data bindings are never duplicated per theme. The Course Journey renderer switches only presentation tokens between the playful child trail and the calm teen/adult roadmap.

---

## 9. Groups

Groups are a core entity.

A group should connect:

- group name;
- students;
- course;
- schedule or calendar relationships where needed;
- a physical `courseJourney` snapshot shared with the reusable dashboard map;
- common learning-target updates plus per-student overrides.

Group Details presents the physical Course Journey as a distinct, high-contrast workspace and links its assigned course directly to Course Details. The roster intentionally does not show one aggregate learning-status badge per student: Needs practice, Developing and Confident remain attached to specific learning targets, where they are meaningful.

---

## 10. Courses

Courses are a separate module/entity.

A course may contain:

- title;
- cover/image;
- units;
- skills / progress structure;
- students or groups using the course;
- materials.

### Important image requirement

Course and unit covers are selected from the public local gallery in `assets/images/gallery`. The admin Add/Edit flow stores the selected relative URL/path and shows it throughout the application. New files are added to the repository and registered in `assets/images/gallery/manifest.json`; runtime upload is intentionally unavailable so the project does not require Firebase Storage or the Blaze plan.

Course Details uses `course-details-units-grid-reference.png` as its direct visual reference. It shows the course cover and metadata above an adaptive real-data unit-card grid (3 columns on desktop, 4 only on wide desktop, 2 on tablet and 1 on mobile). Unit cards use 16:9 covers, show learning-objective counts and open the existing unit workflow.

### Reusable course-program pilot

The course module supports a reusable master-program layer without attaching group/student pacing to the master. The first pilot is `Wider World 1` with exactly `Unit 4 — Live and Learn`; Units 5–9 are deliberately deferred. Course pages prioritize title/level/goal, units, lessons and learning targets; outcomes and resources remain optional supporting fields.

Actual lessons use top-level `lessons/{lessonId}` records and the same generic Lesson Card, Details and Editor for every course. Unit 4 has seven planned lesson records. Physical progress belongs to each group/student `courseJourney`, not to the master lesson setup status. Existing unit learning-target definitions and objective-progress documents remain separate.

The Lesson editor presents Vocabulary, Grammar, Reading, Listening, Speaking and Writing as expandable learning-target groups. Inside a group, the teacher selects an existing Unit target or writes a concrete new one. New targets are stored in the existing Unit objective catalog and linked to the Lesson in the same atomic save, so Quick Update can reuse them immediately. Lesson skill tags are derived from selected targets rather than maintained as a disconnected checkbox list. See `docs/lesson-learning-target-editor-spec.md`.

Vocabulary is managed externally in Miro and is no longer a required course-program layer. New installers store empty vocabulary arrays and the active editor/detail workflow does not expose catalogs. Teachers may still mention vocabulary inside learning-target names or private observations. A confirmed cleanup action removes legacy arrays without affecting learning data. See `docs/universal-lessons-and-vocabulary-spec.md`.

`Own It! A2` is the second program in this same universal course system. Its active sequence is Units 6–9. Unit 6 (`Hidden Danger`) has eight planned lessons and learning targets; Units 7–9 are intentionally empty shells. Installation deliberately omits textbook vocabulary lists. It uses the reusable installer and local gallery covers, with no Own It-specific UI. See `docs/own-it-a2-course-program-spec.md`.

Because students may read their assigned course and units, teacher notes and internal More details live in the admin-only `courseProgramPrivate` collection. Full field definitions, stable pilot IDs, local gallery paths and acceptance checks are documented in `docs/wider-world-course-program-spec.md`.

The approved image architecture uses local public gallery paths and stable Firestore URL/path fields. Students use `avatarImagePath` / `avatarImageUrl`; courses and units use `coverImagePath` / `coverImageUrl`. Binary data is never stored in Firestore. See `docs/course-images-and-units-spec.md`.

---

## 11. Student avatars / image upload

The same requirement applies to students.

Admin Add/Edit Student supports shared Girl/Boy illustrated avatars or initials. The choice stores a local gallery URL/path and appears in Students List and Student Profile. The application never infers this choice from the student's name. Additional non-sensitive reusable avatars can be registered in the local gallery manifest.

Unit covers use the same local-gallery preview, choose, replace, remove and fallback component as course covers.

This is a fixed product requirement, not an optional visual enhancement.

---

## 12. Direct student feedback

Teacher Observations are retired from the active product. Quick Update does not create or display private observation records. Existing `teacherNotes` remain an admin-only legacy archive and are preserved without automatic migration or deletion.

The approved active workflow is: **Quick Update → Feedback draft or explicit send → Student profile**.

- Compact fields are What went well, Next focus and optional Teacher message.
- Drafts remain admin-only in every state.
- `Save & send feedback` is the explicit publication action.
- A student reads only their own `feedbackVersions` records with status `published`.
- Published versions are immutable.
- Progress-linked drafts store `progressHistoryId`; Edit progress can update and explicitly republish a new version.
- Group Quick Update has optional student-facing feedback per student and no private-note visibility mode.

The detailed contract is in `docs/feedback-workflow-spec.md`.

---

## 13. Payments module

Teacher Dashboard should include a payments area.

Potential responsibilities:

- student/group;
- amount;
- payment date;
- paid/unpaid/status;
- period;
- notes.

The exact financial model has not yet been finalized.

---

## 14. Calendar

The teacher prefers an **own calendar inside the dashboard**, rather than mixing everything into an external calendar-only workflow.

Requirements already agreed:

- different students should have their own colors;
- many distinct colors may be needed;
- a student’s color should remain persistent;
- these colors should be visible in the calendar.

### Important

**Tasks / To‑Do should NOT be mixed into the calendar.**

Calendar and tasks are separate modules.

---

## 15. Tasks / To‑Do

A separate task management module is required.

Possible fields:

- task;
- due date;
- priority;
- status;
- related student/course/project;
- notes.

Exact visual structure is still open.

---

## 16. Materials Library

A major future module.

Purpose:

Store and find the teacher’s own:

- worksheets;
- games;
- lesson materials;
- courses;
- notes;
- links;
- other teaching resources.

Materials may eventually be:

- free;
- paid.

There may later be an external/public-facing version of this module, possibly with user login (VK was mentioned as one possible option).

The public/external materials library should remain conceptually separate from the private closed Teacher Dashboard.

---

## 17. AI search / “Ask AI”

Important future feature.

The teacher wants an AI search widget over their own knowledge base/materials.

Example natural-language queries:

- “Подбери материал на тему Travel and Tourism.”
- “Идеи для разминки на 10 минут.”
- “Где запись про ElevenLabs?”
- “Найди задания для повторения Present Simple.”

The AI should answer from the teacher’s **own stored content**, not just general internet knowledge.

This could become a separate AI layer on top of:

- materials library;
- notes;
- teacher observations;
- project data;
- other stored resources.

Visual idea: an **Ask AI** widget/search area.

---

## 18. Social Media module

Teacher Dashboard should contain a social/content planning module.

Use cases:

- Reel ideas;
- post ideas;
- content plan;
- status;
- deadline;
- link;
- notes.

Potential integration:
- connect this module with the existing Instagram cover-generation workflow/agent.

---

## 19. Gamification

Gamification should be controllable by the teacher.

Student-facing gamification can later include:

- badges;
- rewards;
- achievements;
- progress milestones;
- other motivational mechanics.

Exact mechanic is not finalized.

---

## 20. “My Learning”

The main Teacher Dashboard should include a **My Learning** block/module for the teacher’s own English development.

This was explicitly preferred for the dashboard.

Possible future contents:

- active vocabulary;
- grammar focus;
- learning goals;
- speaking practice;
- course/module progress;
- notes.

---

## 21. Main dashboard visual direction

Preferred visual direction:

**cozy Ghibli-like / warm illustrated dashboard style**

Important: it should feel tasteful and usable, not childish.

The chosen main-screen direction was **Variant C**.

Later visual changes included:

- replace generic quote area with **Word of the Day**;
- include a **My Learning** block.

---

## 22. Existing visual references

Named references should remain consistent.

### `students-list`

This is the saved visual reference for the **Students List** screen.

Use the name:

`students-list`

when referring to this design in future work.

### `courses-list-reference`

A Courses List visual reference was also created/requested and tracked under:

`courses-list-reference`

Use existing references when continuing the UI rather than re-inventing the design language.

---

## 23. Students List

The Students List should follow the approved visual direction and use student avatars/photos.

Future implementation should support:

- search/filter later if useful;
- open student profile;
- add student;
- edit student;
- image upload/selection.

Do not hardcode student images.

---

## 24. Courses List

Courses List should use the same overall product design language.

Course cards/list items can display:

- course cover;
- name;
- basic status/information;
- students/groups;
- progress or other summary later.

Course images must be uploadable/selectable in admin forms.

---

## 25. Admin Add/Edit forms

For entities such as Students and Courses, admin forms should be designed for actual database use.

Minimum image functionality:

1. Upload image.
2. Choose image if already uploaded.
3. Save resulting URL/path to entity data.
4. Render saved image in list/profile.

Avoid UI mocks that cannot later connect cleanly to Firebase.

---

## 26. Design philosophy

The system should balance:

- cozy/personal teacher aesthetic;
- clarity;
- useful information density;
- simple navigation;
- real functionality.

Avoid making the product look like a generic corporate CRM.

Avoid overly childish visuals.

The design should support long-term daily teacher use.

---

## 27. Miro

Miro is used for project planning/visual organization.

The teacher wants the ability to embed the project in Miro using an iframe where possible.

---

## 28. Widgets / interactive teaching tools

Current external tools/workflows mentioned:

- Wordwall;
- Bamboozle (liked, but paid);
- own widget editor with embed functionality.

Long term, some external interactive tools may be replaced by the teacher’s own widgets/games.

This does not need to be solved in the first Teacher Dashboard version.

---

## 29. Related ecosystem

The Teacher Dashboard is part of a wider teacher tech ecosystem.

Existing/parallel projects include:

- custom teaching games hosted via GitHub Pages;
- Student Progress tooling;
- Instagram cover agent;
- Framelab / possible hub/start page for tools and projects;
- materials library;
- AI knowledge search.

The dashboard can gradually become the central place that links these tools together.

---

## 30. Development workflow with AI / Codex

For development tasks, prefer explicit project specs.

Useful recurring workflow:

1. Agree on feature/product logic in ChatGPT.
2. Create/update `.md` spec.
3. Keep the spec in the project repository.
4. Ask Codex to implement from the `.md`.
5. Test.
6. Fix issues.
7. Update the source-of-truth spec when decisions change.

Example prompt pattern already considered:

> Напиши подробную инструкцию в `.md` формате для ИИ, чтобы создать / реализовать функцию.
>
> Вынеси эту инструкцию в отдельный файл в проекте.
>
> Реализуй функцию по данному `.md` файлу.

---

## 31. What is already decided

Treat the following as **approved project decisions** unless explicitly changed later:

- Firebase / Firestore is the database direction.
- Teacher Dashboard is private / protected.
- Admin and student roles are separate.
- Students only see their own permitted data.
- Groups → Students → Student Page is a core hierarchy.
- Courses are separate entities.
- Progress is structured by unit-specific learning objectives grouped into Vocabulary, Grammar, Reading, Listening, Speaking and Writing.
- Writing is a full language category and is present only in units with Writing objectives.
- Homework is a separate Learning habits block and never contributes to language-skill calculations.
- Objective statuses are Needs practice, Developing, Confident and Not assessed; the current UI does not use manual percentages.
- Unit headers show completed lessons / total lessons and physical completion percentage, never an aggregate learning label such as Confident.
- Expanded unit progress accumulates the real learning targets recorded across saved lesson updates and groups them by language skill.
- Quick Update stores worked-on objectives separately from optional assessed status changes and never assigns a status automatically.
- Teachers can add and persist a Unit/Lesson objective directly inside Progress Update.
- Progress-history entries remain editable and deletable, including date, unit/lesson, target selection, optional statuses and physical completion; current physical and learning progress is recalculated from remaining history.
- Teacher notes/goals/strengths/weaknesses belong on the student side of the system.
- Teacher Observations are retired from the active UI; existing `teacherNotes` remain a protected legacy archive and are not deleted automatically.
- Feedback drafts are teacher-only; students see only their own explicitly published feedback versions.
- Publishing feedback always requires an explicit teacher action and published versions are immutable.
- Calendar and To‑Do are separate.
- Students have persistent calendar colors.
- Materials Library is required.
- AI search over the teacher’s own knowledge/materials is a desired future module.
- Social Media module is required.
- Gamification control is required.
- My Learning is required.
- Main dashboard visual direction is cozy Ghibli-like, tasteful, not childish.
- Main dashboard direction: Variant C.
- Word of the Day belongs on the main dashboard.
- Student and course images must be uploadable/selectable through admin forms.
- Existing visual reference names should be preserved (`students-list`, `courses-list-reference`).
- Feature specs should be stored in `.md` files for AI/Codex implementation.

---

## 32. What is NOT finalized yet

Do not invent these without discussing them first:

- final Firestore schema for every module;
- exact document fields for all collections;
- any future replacement of the approved objective-status aggregation logic;
- complete payments data model;
- complete gamification logic;
- exact task board UI;
- exact calendar implementation;
- AI search architecture / embeddings / vector database choice;
- public Materials Library authentication;
- final navigation structure;
- full responsive/mobile behavior;
- final deployment architecture.

When working in a new chat, separate **approved decisions** from **proposals**.

---

## 33. Recommended next development steps

Current sensible order:

### Phase 1 — Stabilize core app

1. Authentication.
2. Protected routes.
3. Roles and Firestore Security Rules.
4. Groups.
5. Students.
6. Courses.
7. Student–course relationship.

### Phase 2 — Student management

8. Students List.
9. Student Page.
10. Add/Edit Student.
11. Student image upload.
12. Progress model.
13. Teacher observations.

### Phase 3 — Teaching operations

14. Courses List / Course Page.
15. Groups UI.
16. Calendar.
17. Tasks / To‑Do.
18. Payments.

### Phase 4 — Teacher ecosystem

19. Materials Library.
20. Social Media module.
21. My Learning.
22. Gamification controls.

### Phase 5 — AI layer

23. Search/index teacher’s own content.
24. “Ask AI” interface.
25. Connect AI search to materials, notes and relevant dashboard data.

This sequence can be adjusted, but avoid building the AI layer before the underlying data/content structure is stable.

---

## 34. Instructions for a new ChatGPT / Work / Codex session

When this file is supplied in a new session, assume:

1. This document is the project’s current master context.
2. Items under **What is already decided** are approved.
3. Do not silently redesign approved decisions.
4. If proposing a change, clearly label it as a proposal.
5. Preserve existing reference names.
6. Prefer implementation that can connect cleanly to Firebase.
7. Do not hardcode data/images where admin editing is required.
8. Keep teacher-only and student-facing access clearly separated.
9. Keep the cozy visual identity without sacrificing usability.
10. Update this master context when an important project decision changes.

---

## 35. Short project prompt

Use this when a short context is enough:

> I am building a private Teacher Dashboard for an online English teacher using Firebase/Firestore. Its core hierarchy is Course → Unit → Lesson → Learning Target. Physical progress is completed lessons / total lessons and is the only percentage; learning targets use Needs practice, Developing and Confident. Group Quick Update applies a lesson's shared target results and individual overrides, then publishes physical Course Journey snapshots to the group and included students. Homework is a separate Learning habits block. Teacher Observations are retired; feedback is written directly and students see only explicitly published versions. Vocabulary lists live in Miro rather than the platform. Admin and student roles must remain separated. Student components are shared across child, teen and adult themes. The UI is cozy, Ghibli-like but not childish, and local gallery assets are selected through admin forms. Use the attached master-context file as the source of truth and do not change approved decisions without explicitly proposing the change.

---

## 36. Maintenance rule

Whenever an important decision is made, update this file.

Examples:

- new collection/schema approved;
- progress logic finalized;
- a module is removed/added;
- visual reference is approved;
- Firebase rule changes;
- route structure is finalized;
- image storage approach is selected;
- AI search architecture is selected.

The goal is that **any new chat or AI coding session can recover the project accurately from this single file without relying on memory of previous conversations.**

---

## 37. Independent learning without a course

An individual student may have no `courseId`. In that case the interface uses the label **Independent learning** rather than `Unknown course`.

Student Quick Update supports two scopes:

- `course`: the existing Course → Unit → Lesson workflow, including optional physical lesson completion;
- `independent`: date plus teacher-created learning objectives, with optional statuses, homework, feedback and goal changes.

Independent updates do not create placeholder curriculum documents and do not affect Course Journey percentages. They are stored in progress history with `scope: "independent"`, can be edited or deleted, and publish only a safe current-target snapshot to the student document. Feedback remains private until the teacher explicitly publishes it.

See `docs/independent-learning-updates-spec.md`.

---

## 38. Compact Student Profile lists

Admin Student Profile initially shows three Unit Learning Plan unit cards and the three newest Progress Updates. `Show all units` and `Show all updates` expand the corresponding complete list, and each list can be collapsed again. This is presentation-only: all records remain in Firestore and no pagination or deletion is performed.

---

## 39. Student Profile learning workspace

Admin Student Profile keeps Feedback and Homework in two dedicated adjacent panels rather than mixing homework into each expanded Unit card. Unit learning targets render as a compact responsive grid of language-skill cards. The shared Course Journey renderer adds a live SVG route layer so the green completed segment is derived from physical lesson completion and follows the lesson stops in both admin and student-facing views.

---

## 40. Course Journey decorative layers

The teen/adult Course Journey no longer stretches the complete roadmap PNG to the dimensions of the route canvas. Leaves, books and the finish flag are rendered as separate aspect-ratio-preserving crops of the existing asset, while the route itself remains a live SVG based on physical lesson completion. This prevents decorative books from appearing flattened and keeps 100% completion connected to the finish.

---

## 41. Student Word Practice AI

The Student Portal includes a native `AI Practice` page at `student.html#ai-practice`. For deadline-safe integration it embeds the separately deployed Word Practice AI application in a responsive iframe and provides a new-tab fallback link. Teacher Dashboard does not make cross-origin practice API requests, store AI request history or contain provider credentials. No Firestore rule or schema change is required. See `docs/word-practice-ai-spec.md`.

---

## 42. Direct feedback editing

Every Feedback card on the admin Student Profile has an `Edit feedback` action, including legacy or standalone feedback that has no `progressHistoryId`. Saving from this compact editor updates the feedback draft and publishes a new student-visible version while preserving any legacy `nextStep` text not shown in the compact form. `Delete feedback` atomically removes the private draft and all linked published versions, so it disappears from both teacher and student views. Editing or deleting feedback does not change progress updates, learning status, physical completion or homework.
