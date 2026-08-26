# Teacher Feedback Workflow

## Goal

Convert private lesson observations into teacher-reviewed student feedback without exposing raw notes or publishing automatically.

```text
Private observations
  → Generate feedback
  → Editable draft
  → Teacher review
  → Approve & Publish
  → Student profile
```

## Observation contract

New Quick Update observations are stored in `teacherNotes` with:

```text
studentId
courseId
unitId
lessonDate
lessonContext
skillCategory
learningTargetId
learningTargetTitle
targetStatus
text
includeInFeedback
createdAt
```

`teacherNotes` is admin-only. Older notes without a linked learning target remain readable to the teacher but cannot generate feedback until a new linked observation is recorded.

## Draft contract

`feedbackDrafts/{feedbackId}` stores the editable working document:

```text
studentId
courseId
sourceObservationIds[]
content.whatWentWell
content.whatToPractise
content.nextStep
generator
status: draft | published | archived
latestVersionNumber
latestPublishedVersionId
createdAt
updatedAt
publishedAt
```

Drafts are always admin-only, including drafts whose workflow status is `published`.

## Teacher workspace

The admin student profile presents this workflow as one compact responsive workspace:

- the left column (about 45%) lists private observation cards with skill/date, course and unit, learning target, lesson context and the full private note;
- each linked observation can be selected with `Include in feedback`; the Generate action reflects the live selection count and is disabled at zero;
- observation editing updates only the private `teacherNotes` document and cannot mutate an existing published version;
- the right column (about 55%) contains the active feedback record, its status and source unit/category chips;
- drafts are editable inline and require an explicit `Approve & Publish` action;
- published records are read-only until `Edit and republish` prepares the next editable draft;
- when no draft exists, the right column shows an empty state and no synthetic feedback;
- at tablet and mobile widths, observations are shown first and feedback second without horizontal scrolling.

## Published version contract

Approve & Publish creates a new immutable `feedbackVersions/{versionId}`:

```text
feedbackId
studentId
courseId
sourceObservationIds[]
content.whatWentWell
content.whatToPractise
content.nextStep
status: published
versionNumber
publishedAt
```

The content is copied as a snapshot. Later observation edits, draft edits or republishing cannot modify an existing version. Edit and republish creates the next version number.

## Generator boundary

`FeedbackGenerator` is the stable interface. `TemplateFeedbackGenerator` is the current implementation because the project has no secure server-side AI endpoint. It:

- performs no network request;
- needs no API key;
- uses target titles, categories and status metadata;
- never copies raw observation text to the student draft;
- always requires teacher review before publication.

A future AI adapter must run behind an authenticated server endpoint, verify the caller is admin, keep all credentials server-side and return only a draft. It must never publish automatically.

## Security

- Admin can read/write `teacherNotes` and `feedbackDrafts`.
- Admin can create published versions.
- Published versions cannot be updated or deleted by client code.
- Student can query only their own `feedbackVersions` where `status == published`.
- Student cannot read observations or drafts and cannot create, edit or publish feedback.

## Manual acceptance test

1. As admin, add a linked observation in Quick Update and select Include in feedback.
2. Select one or more observations and generate a draft.
3. Confirm the student account cannot see the draft.
4. Edit all three sections and click Approve & Publish.
5. Confirm only the linked student sees the published version.
6. Edit the original observation and confirm the published version is unchanged.
7. Click Edit and republish, change the draft, and publish again.
8. Confirm a new version appears while the earlier version remains unchanged.
9. Select zero, one and multiple observations and verify the Generate label and disabled state.
10. Check long targets and notes at desktop and mobile viewport widths.
