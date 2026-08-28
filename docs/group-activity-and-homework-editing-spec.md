# Group activity and homework editing

## Group Details

Group Details includes a compact `Group Activity` workspace with three real-data lists:

- Progress updates from `progressHistory` are grouped by Unit, Lesson and lesson date. A shared group update is shown once, with the individual student records inside it.
- Feedback from `feedbackDrafts` shows the current Draft, Published or Archived state and the teacher-written content for each student.
- Homework from `homeworkAssignments` shows the student, Unit/Lesson context, due date, current status, instructions and safe PDF/web resources.

Each activity record provides an explicit route to the related Student Profile. Empty lists show a calm empty state. No mock content is created.

The group activity lookup is admin-only and does not alter Firestore rules. Progress records are included when they explicitly reference the group, or when they belong to a current group member in the group's assigned course. Feedback and homework are limited to current members and the assigned course.

## Student Profile homework editor

Every existing homework row inside `Learning Objectives` has an explicit `Edit` action. The editor supports:

- title;
- instructions;
- optional due date;
- Assigned, Completed or Needs completion status;
- up to five HTTPS links or repository PDF resources.

The editor updates the existing `homeworkAssignments/{assignmentId}` document. It preserves student, course, Unit, Lesson and scope links and does not create a progress update, change learning-target status or publish feedback.

Resource URLs are validated by the shared homework domain helper. PDF files remain repository assets under `assets/materials/homework`; binary files are not stored in Firestore.

## Compact student profile lists

- Unit Learning Plan shows the first three unit cards initially and offers `Show all units` when more exist.
- Progress Updates shows the three newest saved records initially and offers `Show all updates` when more exist.
- Expanded lists can be collapsed again. These controls affect only presentation; every record remains stored in Firestore.
