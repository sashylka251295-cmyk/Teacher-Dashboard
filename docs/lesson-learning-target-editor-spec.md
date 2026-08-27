# Lesson learning-target editor

## Purpose

The Lesson editor connects curriculum planning directly to Quick Update. A teacher should be able to describe the concrete learning content of a lesson without first leaving the Lesson form to edit the whole Unit.

## Interaction

- `Vocabulary`, `Grammar`, `Reading`, `Listening`, `Speaking` and `Writing` are expandable groups.
- Opening a group shows the Unit targets that already belong to that skill.
- The teacher may select an existing target or enter a concrete new target inside the expanded group.
- Adding a new target selects it immediately. The Lesson may contain 1–3 key targets in total.
- Skill tags are derived from the selected real targets; they are not maintained as a second, disconnected field.

Examples of concrete targets include `Places`, `Prepositions of place` and `Talking about places they need to go to`. The skill name by itself is not a learning target.

## Persistence

When the Lesson is saved, a newly entered target is stored in the existing `units/{unitId}.objectives` array with a stable ID, category and order. Its ID is stored in `lessons/{lessonId}.learningTargetIds`, and the lesson's `skillTags` are derived from the selected targets.

The Lesson and Unit programme changes are committed in one Firestore batch. Cancelling the form does not create an orphan target.

No new collections or security-rule permissions are required. Student-specific learning statuses remain in progress data and are never written into the Course or Unit definition.

## Downstream behaviour

Quick Update reads the Lesson's linked targets through the existing Unit/Lesson objective helpers. Therefore a target entered in the Lesson editor is automatically available when that Lesson is selected after class. Existing Unit targets, legacy skill goals and existing Lesson records remain supported.

## Acceptance checks

1. Every language-skill group can be opened and closed.
2. Existing Unit targets can be selected and unselected.
3. A concrete target can be added with the keyboard or the explicit Add target button.
4. More than three selected targets are rejected.
5. Re-entering the same title in the same skill reuses the existing Unit target.
6. Saving persists the Unit target and Lesson link together.
7. Reopening the Lesson restores the selected targets.
8. Quick Update pre-fills the saved Lesson targets.
