# Teacher Calendar

The Calendar is a teacher-only scheduling module. It does not create a second progress system and is not exposed in Student Portal.

Week and Today include a compact month picker on the left. Its arrows browse months independently; choosing a date moves the main calendar to that date. Scheduled cards prioritise the student or group name and time. Successful create/edit actions return directly to the calendar without adding a layout-shifting confirmation row.

Student Portal never reads the private `calendarEvents` collection. Calendar writes maintain one sanitised `studentScheduleEntries` projection per recipient. Individual events project to the selected student; group events project to every current student whose `groupId` matches. The projection contains scheduling fields only and drives the existing **Next Lesson** dashboard card. Cancelling or rescheduling the teacher event updates the same projections.

## Firestore model

Collection: `calendarEvents`

Each document stores:

- `startAt`: Firestore timestamp for the first or single occurrence;
- `durationMinutes`: integer duration; end time is derived;
- `participantType`: `student`, `group`, or `manual`;
- `studentId` or `groupId`: one stable relation for existing participants;
- `manualTitle`: label for a manual event that does not create a participant;
- `displayName`: compact calendar snapshot;
- `calendarColor`: muted palette color snapshot;
- `courseId`: optional course context chosen in the compact scheduling form;
- `unitId`, `lessonId`: optional legacy curriculum context retained when older events are edited, but no longer selected in Calendar;
- `status`: `planned`, `completed`, `cancelled`, or `rescheduled`;
- `notes`: optional private teacher note;
- `recurrence`: `{ frequency, intervalWeeks, until }`;
- `occurrenceOverrides`: map keyed by the original local `YYYY-MM-DD` occurrence date;
- `createdAt`, `updatedAt`: server timestamps.

End time is derived from `startAt + durationMinutes`. A repeating series is stored once. Completing, cancelling, or rescheduling one occurrence writes a small override instead of duplicating the series.

## Participant colors

The existing `students.color` field is reused as the student's calendar color. `groups.color` uses the same naming convention. There is no duplicate `calendarColor` field on participant records. Older values outside the calm Calendar palette are deterministically assigned a palette color when next used or saved.

Occupied colors are calculated client-side from the currently loaded Students and Groups. Reuse is allowed only after the teacher sees the names already using that color and selects `Use anyway`.

## Progress integration

Completing a student event marks only the calendar occurrence as completed, then opens that student's existing Quick Update with the date and any saved curriculum context preselected. Unit and Lesson are chosen in Progress Update, where they belong. Group events open the existing Group Quick Update in the same way. `Mark this lesson completed` remains unchecked so calendar completion never invents learning status or physical course completion.

## MVP recurrence limitation

Creation supports no repeat, weekly, every two weeks, and a custom interval in weeks, with an optional end date. Complete, cancel, and reschedule operate on the selected occurrence. `Edit` updates the series definition. Splitting a series into “this and future” is intentionally deferred.
