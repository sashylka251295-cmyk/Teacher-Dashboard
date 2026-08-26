# Fast Progress Update

## Product goal

Progress Update is a one-minute post-lesson action, not a teaching journal. The normal path is:

```text
Select student/group → date → Unit → Lesson → worked-on objectives → complete lesson → Save update
```

## Learning objectives

- The selected lesson's existing objectives are loaded automatically.
- Objectives start unselected; the teacher selects only what was actually covered.
- Selection means `worked on` and does not imply mastery.
- Status is optional. The only assessed values remain `needs_practice`, `developing` and `confident`.
- `+ Add learning objective` creates a stable objective on the current Unit and links it to the current Lesson in the same action.
- A new objective requires a title and one language skill: Vocabulary, Grammar, Reading, Listening, Speaking or Writing.

Progress history stores `workedOnObjectives[]` separately from assessed `changes[]`. The latest worked-on objectives are copied to the student/group `courseJourney.currentLearningTargets`, so dashboards show the real lesson focus even when the teacher deliberately records no status.

## Physical progress

`Mark this lesson completed` remains independent from learning statuses. Saving recalculates:

```text
completed lessons / total lessons × 100
```

This is the only percentage in the workflow.

## Group defaults and individual exceptions

The teacher selects Unit, Lesson and shared objectives once. The selected objectives apply to every included student. Opening a student card is optional and is used only to remove a shared objective, override an optional status, add homework, update a goal or add individual feedback.

## Optional feedback and privacy

Individual feedback is optional and has an explicit visibility choice:

- `Private teacher note` creates a teacher-only observation.
- `Published student feedback` creates a separate immutable published feedback version for that student.

Private observations are never copied into student-readable data. Draft-generation and the existing reviewed feedback workflow remain available independently.

## Revision

Admin Student Profile keeps `Edit progress` on every progress-history entry. A revision can change lesson date, physical completion, selected worked-on objectives and optional statuses. Delete removes the update and recalculates affected current status/physical progress from remaining history. Observations, homework and published feedback remain separate records and are not deleted implicitly.

## Visual direction

The shared Course Journey renderer uses interactive HTML lesson states over theme-specific isolated decorative assets:

- child: `assets/images/course-journey-child-trail.png`, derived from the composition of `course.journey.child.png`;
- teen/adult: `assets/images/course-journey-adult-roadmap.png`, derived from `course.journey.adult..png`.

Reference screenshots are never embedded as complete UI screenshots.
