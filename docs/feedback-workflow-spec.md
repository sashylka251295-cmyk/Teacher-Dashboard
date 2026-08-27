# Direct Student Feedback Workflow

## Product decision

Teacher Observations are no longer part of the active Teacher Dashboard workflow. The teacher writes student-facing feedback directly after a lesson without maintaining a second private observation record.

```text
Quick Update
  -> Write feedback
  -> Save private draft or explicitly send
  -> Published feedback in the linked student profile
```

Existing `teacherNotes` documents are preserved as a protected legacy archive. The application does not display, create, edit, publish, migrate, or delete those records. Students cannot read them.

## Quick Update

The optional Student feedback section contains:

- `What went well`;
- `Next focus` (stored as `whatToPractise`);
- optional `Teacher message`.

`Save update` may store the entered feedback as an admin-only draft. `Save & send feedback` is the explicit student-facing publication action. Feedback is optional and a normal learning-progress update does not require it.

Group Quick Update provides optional student-facing feedback inside each included student card. It has no Private teacher note mode. Saving the group update publishes only feedback that the teacher explicitly entered for that student.

## Draft contract

`feedbackDrafts/{feedbackId}` stores the editable working record:

```text
studentId
courseId
unitId
lessonId
progressHistoryId
learningTargetIds[]
content.whatWentWell
content.whatToPractise
content.nextStep
content.message
source: progress_update
status: draft | published | archived
latestVersionNumber
latestPublishedVersionId
createdAt
updatedAt
publishedAt
```

Drafts are always admin-only. A draft is never visible in the Student Portal.

## Published versions

Publishing creates a new immutable `feedbackVersions/{versionId}` snapshot. It belongs to exactly one `studentId` and copies the reviewed content and progress context. Students can read only their own records with `status == "published"`.

Edit progress loads feedback linked by `progressHistoryId`. `Update published feedback` creates the next immutable version; it never mutates an earlier published version. Deleting a progress update does not silently delete already published feedback.

## Security

- Admin can read/write feedback drafts and create published versions.
- Published versions cannot be updated or deleted by client code.
- Student can read only their own published feedback versions.
- Student cannot read drafts or legacy `teacherNotes`.
- Student cannot create, edit, publish, or republish feedback.

## Manual acceptance test

1. Save a Quick Update without feedback and confirm progress still saves.
2. Enter feedback and click Save update; confirm it remains a private draft.
3. Enter feedback and click Save & send feedback; confirm only the linked student sees it.
4. Open Edit progress, change the feedback and explicitly republish it.
5. Confirm the new version is visible and the previous published version is unchanged.
6. Run a Group Quick Update with feedback for one student and confirm no other student receives it.
7. Confirm no Teacher Observations panel or Private teacher observation field appears.
8. Confirm existing legacy `teacherNotes` remain unreadable to student accounts.
