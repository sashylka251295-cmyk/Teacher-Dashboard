# Wider World 1 Course Program Pilot

## Scope

This pilot adds a reusable master-course program and demonstrates it with exactly one unit:

- `Wider World 1`
- `Unit 4 — Live and Learn`

Units 5–9 are intentionally not created. The master course contains no group schedule or `lessons per week`; pacing belongs to a future assignment/override layer.

## Firestore model

The feature extends the existing top-level architecture instead of introducing nested competing course data:

```text
courses/{courseId}
units/{unitId}
lessons/{lessonId}
courseProgramPrivate/{noteId}
```

Course public fields include `name`, `edition`, `level`, `ageRange`, `defaultStartingPoint`, `description`, `generalGoal`, `active`, and the existing cover fields.

Unit public fields include the existing identifiers, cover and `objectives` plus `estimatedLessons`, `priority`, setup `status`, `mainGoal`, separate `skillGoals`, `successCriteria`, `finalOutcome`, and `resources`. Existing learning targets remain independent from broader skill-goal descriptions so objective progress and Quick Update continue to work. Legacy vocabulary fields are not part of the active course workflow.

The completed pilot now contains seven real, fully structured Lesson records. Future lessons are created only when the teacher uses Add Lesson; the system never manufactures additional blank records. Each lesson uses the universal model documented in `universal-lessons-and-vocabulary-spec.md`.

`courseProgramPrivate` is admin-only. It holds course/unit teacher notes and the optional More details fields. This separation prevents internal notes from leaking through course/unit documents that students are allowed to read.

Stable pilot IDs are:

```text
courses/wider-world-1
units/wider-world-1-unit-4
```

## Images

The existing source illustrations were copied into the local gallery:

```text
assets/images/gallery/course-covers/wider-world-1-course-cover.png
assets/images/gallery/unit-covers/wider-world-1-unit-4-live-and-learn.png
```

They are registered in `assets/images/gallery/manifest.json`. No Firebase Storage or Blaze plan is required.

## Creating the pilot data

Open Courses as an authenticated admin and click `Add Wider World 1 pilot`. The action refuses to overwrite an existing `courses/wider-world-1` document. It creates only the master course, Unit 4 and empty private-note documents. All content is subsequently editable through Edit Course and Edit Unit.

## Physical progress

The master course never owns learner progress. Each assigned group/student stores a `courseJourney` snapshot. For its current unit, physical progress is:

```text
completed lesson IDs / actual lesson stops
```

For example, three completed lessons among seven real stops display `3/7 · 43%`. Learning targets use Needs practice, Developing and Confident rather than percentages.

## Security

- Existing course and unit writes remain admin-only.
- `lessons` and `courseProgramPrivate` are admin-only for read and write.
- Student access to existing course/unit data remains unchanged.
- Course and unit cover paths are still restricted to the corresponding local gallery folders.

Deploy the updated rules after review:

```powershell
firebase deploy --only firestore:rules
```

## Acceptance checks

1. Install the pilot once and confirm the second attempt does not overwrite it.
2. Open Wider World 1 and verify only Unit 4 is present.
3. Edit every course and unit program field and reload.
4. Add/edit resources and confirm legacy vocabulary is absent from the active workflow.
5. Confirm resource URLs are clickable in normal view.
6. Confirm the seven Unit 4 lesson cards open reusable Lesson Details.
7. Change lesson order and verify the list reorders without changing stable IDs.
8. Publish a lesson update for a group and verify its group/student journey snapshots refresh.
9. Confirm existing unit `objectives` still render and save independently.
10. Test desktop/mobile layouts and Firestore authorization.
