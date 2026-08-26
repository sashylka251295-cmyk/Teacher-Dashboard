# Course Details, Unit Grid and Local Image Gallery

## Course Details and units

`assets/references/teacher-dashboard/course-details-units-grid-reference.png` defines the hierarchy and density of Course Details. The working dialog uses real `courses` and `units` documents. It shows a 16:9 cover, name, level, status, unit count and an adaptive unit-card grid. Learning objectives and the existing progress workflow are unchanged.

The grid uses three columns on normal desktop, four on very wide desktop, two on tablet and one on mobile. Each clickable unit card shows its real number, title, objective count and cover. Edit/Delete remain in the compact menu.

## Local gallery (no Blaze plan)

Images are public static project assets rather than Firebase Storage objects. Binary data is never stored in Firestore. The existing stable fields remain:

```text
students/{studentId}.avatarImagePath / avatarImageUrl
courses/{courseId}.coverImagePath / coverImageUrl
units/{unitId}.coverImagePath / coverImageUrl
```

For a selected image, path and URL contain the same relative public path. Allowed locations are:

```text
assets/images/gallery/student-avatars/
assets/images/gallery/course-covers/
assets/images/gallery/unit-covers/
```

The picker reads `assets/images/gallery/manifest.json`. It supports preview, select/replace, remove, fallback, loading, empty and error states. Girl and boy illustrated avatars are provided as shared defaults; choosing no avatar uses the student's initials. The app never guesses an avatar from a student's name.

## Adding an image

1. Use JPG, PNG or WebP and a filename containing only Latin letters, numbers, dots, underscores or hyphens.
2. Copy it into the matching folder above.
3. Add its label and relative path to the matching `students`, `courses` or `units` array in `manifest.json`.
4. Commit and push both the image and manifest to GitHub.
5. After GitHub Pages updates, choose it in Add/Edit Course, Add/Edit Unit or Add/Edit Student and save.

All gallery assets are public to anyone who can open the deployed website. Never add personal student photographs, documents or confidential material.

## Security

Firestore writes for students, courses and units remain admin-only. Rules accept only the matching local gallery prefix and require the URL to equal the stored path. Students cannot modify these fields. Static GitHub Pages assets cannot be made private; this is why the gallery is limited to decorative covers and reusable illustrations.

No Firebase Storage bucket, Storage Rules deployment or Blaze plan is required.

## Acceptance checks

1. Open courses with zero, one and many units and test the responsive grid.
2. Select, replace and remove local covers for a course and unit.
3. Select Girl/Boy or initials for a student and verify list/profile/student-facing views.
4. Verify missing images use the bundled fallback.
5. Confirm unit learning objectives survive cover edits unchanged.
6. Verify Firestore Rules compile and reject remote or mismatched gallery paths.
