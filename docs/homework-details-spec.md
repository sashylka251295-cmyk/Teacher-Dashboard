# Homework Details and Resources

## Purpose

Homework is an optional Learning habits record. It does not affect physical Course Journey progress or learning-target status.

## Firestore model

`homeworkAssignments/{assignmentId}` keeps the existing ownership and status fields and may also contain:

- `lessonId`: related lesson when available;
- `description`: complete student-facing instructions;
- `dueDate`: optional Firestore Timestamp;
- `resources`: up to five safe `{ title, url, type }` snapshots, where `type` is `pdf` or `link`.

Legacy assignments without these fields remain readable and display a calm fallback message.

## Student experience

- The dashboard Homework card opens the working `#homework` route.
- The sidebar Homework item opens the same page.
- Each assignment expands inline to show instructions, assigned date, optional due date and resources.
- PDF resources include a lazy inline preview plus an explicit Open PDF link.
- Website resources show a compact source card and open in a new tab.

## Resource safety and local PDFs

Only HTTPS URLs and repository files inside `assets/materials/homework/` are accepted. Executable URLs and path traversal are rejected before writing and before rendering.

Runtime uploads are intentionally unavailable because this project does not use Firebase Storage or the Blaze plan. To add a local PDF:

1. copy it to `assets/materials/homework/`;
2. commit and push the file to GitHub;
3. enter `./assets/materials/homework/file-name.pdf` in Quick Update.

Files committed to this folder are public on GitHub Pages and must not contain private student information.

## Security

The existing Firestore rule remains sufficient: admin can create/update/delete assignments, and a student can read only an assignment whose `studentId` belongs to their authenticated profile. Students cannot edit status, instructions or resources.
