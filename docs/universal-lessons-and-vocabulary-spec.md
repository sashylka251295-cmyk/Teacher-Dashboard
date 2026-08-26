# Universal Course and Lesson Structure

## Architecture

Every course uses the same lightweight hierarchy and reusable UI:

```text
Course → Unit → Lesson → Learning Target
```

Lessons remain top-level `lessons/{lessonId}` records with `courseId` and `unitId`. There are no course-specific Lesson components.

## Required curriculum content

- Course: title, level and short description/goal.
- Unit: title, main goal, a few learning outcomes and optional final outcome.
- Lesson: title, one to three linked learning targets and skill tags.
- Learning target: stable ID, real teacher-readable title, primary skill category and optional additional skill categories.

Lesson activities, resources, pronunciation, functional language, private teacher notes and reflection remain optional teacher-side supporting data. Empty optional fields are omitted from normal display.

## Vocabulary boundary

Long textbook vocabulary lists are managed externally in Miro and are not required course structure. The active Unit and Lesson editor/detail flows therefore do not show the former vocabulary catalog. A teacher may still add vocabulary as a real learning-target title or mention it in a private observation.

New Wider World and Own It installations write empty `vocabulary`, `activeVocabulary` and `vocabularyItemIds` arrays. Legacy fields remain readable only for compatibility until the teacher explicitly removes them.

The Courses action `Remove stored vocabulary`:

1. reads existing units and lessons;
2. shows the exact number of affected documents in a confirmation;
3. clears only the legacy vocabulary arrays;
4. refreshes each unit's safe public lesson-stop projection from its real lesson records;
5. leaves learning targets, progress, observations, resources and feedback unchanged.

Cleanup is never automatic because deleting existing teacher data requires an explicit action.

## Lesson target links

`lessons/{lessonId}.learningTargetIds` contains one to three IDs from its parent unit. If an older lesson has no explicit links, the UI temporarily infers up to three targets from its skill goals. Saving the lesson persists explicit links.

`skillTags[]` uses Vocabulary, Grammar, Reading, Listening, Speaking and Writing. A single target can belong to several skills but is assessed once by stable objective ID.

## Progress boundary

Master lesson setup status (`planned`, `ready`, `archived`) is curriculum metadata and never learner progress.

- Physical progress is stored per group/student in `courseJourney` and uses completed lesson IDs only.
- Learning progress is stored in `objectiveProgress` and uses Needs practice, Developing and Confident.
- No learning-target mastery percentage is calculated.

See `docs/physical-and-learning-progress-spec.md` for the shared map and publishing workflow.

## Security

Lesson planning records remain admin-only. Student-facing journey snapshots copy only safe lesson names, numbers, skill tags and learning-target names into the student's own document. Private lesson notes, observations and progress history are never included.
