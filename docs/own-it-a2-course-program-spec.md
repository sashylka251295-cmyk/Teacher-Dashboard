# Own It! A2 Course Program

## Scope

Own It! A2 is registered in the existing universal hierarchy:

```text
courses/own-it-a2
  → units/own-it-a2-unit-6 … own-it-a2-unit-9
    → lessons/own-it-a2-unit-6-lesson-1 … lesson-8
```

No Own It-specific page, unit card, lesson card or progress model exists. Courses List, Course Details, Unit Details, Lesson Details, all shared edit dialogs and the standard Firestore repositories render these records.

## Course metadata

- Name: `Own It! A2`
- Edition: `Own It! 2 Student's Book`
- Level: `A2`
- Default starting point: `Unit 6 — Hidden Danger`
- Frequency: `1 lesson per week`
- Active units: 6–9; Units 1–5 were completed in the previous academic year and are not created as active records.

`frequency` is optional display metadata on the reusable course record. It has no effect on group/student pacing or progress.

## Unit 6

`Hidden Danger` has exactly eight planned lessons. It contains the approved eleven learning objectives, final communicative outcome and optional writing extension inside Lesson 8. The extension does not create a ninth lesson or a standalone Unit Writing objective.

Textbook vocabulary is intentionally not installed. The course installer writes empty vocabulary arrays because vocabulary is managed externally in Miro; vocabulary may still be represented by a specific learning target or private observation.

Physical lesson progress is stored independently on each group/student `courseJourney`; the master lesson setup does not produce learner progress. Objective progress continues to use status labels rather than percentages.

## Units 7–9

`Get Connected`, `High-flyers` and `Show Your Moves` are intentional shell records. They contain their unit number, title, planned state and cover only. Their learning objectives, vocabulary, lessons, resources, goal and final outcome stay empty until approved content is supplied.

## Local visual assets

The supplied source artwork remains in `assets/courses/own-it-a2/`. Runtime records reference copies registered in the local gallery:

```text
assets/images/gallery/course-covers/own-it-a2-cover.png
assets/images/gallery/unit-covers/own-it-a2-unit-6-hidden-danger.png
assets/images/gallery/unit-covers/own-it-a2-unit-7-get-connected.png
assets/images/gallery/unit-covers/own-it-a2-unit-8-high-flyers.png
assets/images/gallery/unit-covers/own-it-a2-unit-9-show-your-moves.png
```

All covers keep the existing card dimensions and `object-fit: cover`. A shared asset-specific focal position keeps the supplied title area visible without stretching the portrait originals.

## Installation and editing

The admin uses `Add Own It! A2` in Courses. The generic installer validates stable IDs, checks all target documents before writing, creates course/unit/lesson/private records and rolls back only records created by a failed installation. A second installation is rejected safely.

After installation, all data is edited through the same Course, Unit, Lesson, Learning Target, Resource and Notes controls used by Wider World 1.

## Schema and security

No new collection, route or Security Rules change is required. `frequency` is an optional course field allowed by the existing admin-owned course document. Covers are repository assets, not Firebase Storage uploads.
