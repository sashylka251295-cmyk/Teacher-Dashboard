# VISUAL_SPEC.md

## 1. Purpose

This file defines the visual direction, layout rules, reference images, and theme logic for the Teacher Dashboard project.

The project already has working Firebase logic and core functionality.

This specification is focused on **UI/UX and visual implementation only**.

Do not change the Firestore data model, Authentication logic, security rules, repository structure, or working CRUD behavior unless required to support the visual UI.

---

# 2. Main Visual Direction

The interface should feel:

- warm;
- calm;
- cozy;
- modern;
- spacious;
- friendly;
- slightly storybook-inspired;
- professional enough for everyday teacher use.

The style should combine:

**modern dashboard UI + approximately 20–25% soft illustrated / cozy atmosphere**

Do not make the Teacher Dashboard childish.

Avoid:

- harsh corporate blue dashboards;
- dark admin panels;
- flat sterile interfaces;
- excessive cartoon decorations;
- emoji as primary interface icons;
- overly saturated colors.

---

# 3. Core Design Language

Use:

- warm cream / off-white backgrounds;
- soft sage and forest-green accents;
- muted lavender, blue, orange and pink secondary accents;
- rounded cards;
- subtle borders;
- very soft shadows;
- generous spacing;
- clean readable typography;
- understated botanical / book-inspired decoration.

Decorative elements must not reduce readability.

Data always has priority over illustration.

---

# 4. Main Layout

The Teacher Dashboard uses:

- permanent left sidebar;
- lightweight top header;
- large main workspace;
- cards and panels;
- responsive desktop-first layout.

The sidebar should remain visually consistent across all Teacher/Admin screens.

---

# 5. Main Teacher Dashboard Reference

Primary reference:

```text
assets/references/teacher-dashboard/teacher-dashboard-main-reference-v1.png
```

Use this as the **main visual reference for the whole Teacher Dashboard platform**.

Important ideas from this reference:

- warm cream background;
- sage-green sidebar;
- clean overview cards;
- search in header;
- teacher profile area;
- quick actions;
- students needing attention;
- recent updates;
- My Learning preview;
- Word of the Day;
- subtle illustrated botanical details.

Do not reproduce dummy numbers or names from the image.

Use real Firestore data.

---

# 6. Teacher Dashboard Navigation

Current / planned navigation:

```text
Dashboard
Students
Groups
Progress
Courses
Calendar
Tasks
Payments
Materials
Content
My Learning
```

Only show functional sections unless a future section is intentionally implemented.

Do not display broken placeholder navigation.

---

# 7. Sidebar

Sidebar style:

- light sage / warm neutral background;
- green active navigation pill;
- clear icons;
- comfortable vertical spacing;
- optional subtle illustration near lower area;
- teacher profile near bottom;
- Settings / Logout at bottom.

Sidebar should not dominate the screen.

It may become collapsible later.

---

# 8. Header

Teacher screens should use a compact top header.

Possible elements:

- page title;
- breadcrumb;
- global search;
- primary contextual action;
- teacher avatar/profile.

Examples:

```text
Students
Search students, groups, courses...
+ Add Student
```

Do not use a large empty decorative header.

---

# 9. Teacher Student Profile

Reference:

```text
assets/references/teacher-dashboard/student-profile-teacher-reference-v1.png
```

This is the main working screen for an individual student.

Important layout:

## Student header

Show:

- avatar;
- student name;
- status;
- group;
- course;
- student color;
- Quick Update button.

Do not expose raw IDs.

---

# 10. Student Profile Summary

Use three primary summary cards:

```text
Overall Progress
Strongest Area
Current Goal
```

Cards should be visually distinct but remain calm.

Do not overuse bright colors.

---

# 11. Progress Matrix

The progress matrix is one of the most important visual components.

Structure:

```text
Skills ↓
Units →
```

Rows:

- Vocabulary
- Grammar
- Reading
- Listening
- Speaking
- Homework

Columns:

- Unit 1
- Unit 2
- Unit 3
- etc.

Requirements:

- easy to scan;
- clear percentages / progress indicators;
- horizontal scroll for many units;
- unit progress visible;
- student colors may be used subtly;
- absence of data should display `—`, not `0`.

---

# 12. Teacher Observations

Teacher Observations must visually appear as private teacher-only notes.

Reference:

```text
student-profile-teacher-reference-v1.png
```

Show:

- unit;
- category;
- date;
- observation.

Use a small:

```text
Private
```

indicator.

Do not expose this block to Student View.

---

# 13. Quick Update

Reference:

```text
assets/references/teacher-dashboard/quick-update-modal-reference-v1.png
```

Quick Update should appear as a centered modal over the Student Profile.

It should remain compact enough to use after every lesson.

Fields:

- Student;
- Lesson Date;
- Unit;
- Skills;
- Short Observation;
- Current Goal;
- Goal Status;
- optional Achievement.

---

# 14. Skill Level Controls

Teacher should work with pedagogical proficiency levels:

```text
Needs support
Developing
Mostly confident
Confident
Independent
```

Do not require the teacher to manually calculate percentages.

Internally the application may map these levels to numeric values.

Use soft color cues.

Avoid aggressive red/green judgment styling.

---

# 15. Students List

Reference:

```text
assets/references/teacher-dashboard/students-list.png
```

Use a structured list/table rather than large student cards.

Important columns:

```text
Student
Group
Course
Level
Overall Progress
Last Lesson
Status
Actions
```

Student row may include:

- avatar;
- name;
- age if available;
- group badge;
- progress bar;
- status;
- View action.

Technical IDs must never appear.

---

# 16. Students Filters

Students page should support visually clear filtering:

```text
All Students
Group
Level
Course
Status
```

Also:

- search;
- sort;
- Active / Paused / Archived.

Filters should be compact and easy to reset.

---

# 17. Group Page

Reference:

```text
assets/references/teacher-dashboard/group-page-reference-v1.png
```

The group page should show:

- group name;
- course;
- academic year;
- group status;
- students in group;
- overall progress of each student;
- current focus / strongest skill;
- recent group updates.

Useful actions:

```text
Add Student
Edit Group
Archive Group
```

---

# 18. Courses List

Reference:

```text
assets/references/teacher-dashboard/courses-list-reference-v1.png
```

Courses should use a readable table/list.

Possible information:

```text
Course
Level
Groups
Students
Units
Status
Actions
```

Use course image / thumbnail when available.

---

# 19. Course Images

Admin must be able to upload or select a custom course image.

Do not hardcode course artwork.

The course data model / UI should support an image URL or storage path.

Use that image in:

- Courses List;
- Course page;
- Student-facing course displays.

---

# 20. Student Photos

Admin must be able to upload or select a custom student photo/avatar.

Do not rely only on generated avatars.

Use the uploaded image in:

- Students List;
- Student Profile;
- Group page;
- Student Dashboard.

If no photo is available, use a neutral fallback avatar.

---

# 21. Add / Edit Student Modal

Reference:

```text
assets/references/teacher-dashboard/add-edit-student-modal-reference-v1.png
```

Fields may include:

```text
Student Photo
Full Name
Group
Course
Status
Student Color
Email
Profile Note
```

The form should also display a preview card.

Use:

- Upload Photo;
- preview;
- Save Student;
- Cancel.

Admin should never manually type Firestore IDs.

---

# 22. Add / Edit Group Modal

Reference:

```text
assets/references/teacher-dashboard/add-edit-group-modal-reference-v1.png
```

Fields may include:

```text
Group Image
Group Name
Course
Academic Year
Status
Primary Teacher
Group Color
Group Note
```

Allow uploading/selecting a group image.

Display a preview card.

---

# 23. Theme Architecture

Student-facing UI must support different visual themes.

Do not make Paddington the permanent visual identity of every student account.

Use at minimum:

```text
child
neutral
```

Possible future values:

```text
teen
minimal
playful
cozy
```

A field such as:

```text
visualTheme
```

may be stored for the student.

Teacher should eventually be able to select the student's theme through Admin UI.

---

# 24. Child Student Theme

Child theme may use:

- Paddington-inspired academy aesthetic;
- stronger illustration;
- playful badges;
- warm storybook environment;
- friendly mascots;
- more visible gamification.

Existing child student-facing references are valid references for this theme.

Do not apply this theme automatically to all students.

---

# 25. Neutral / Adult Student Theme

The neutral theme must work for:

- teenagers;
- adults;
- students who prefer a calmer interface.

Style:

- sophisticated;
- warm;
- elegant;
- calm;
- still friendly.

Use:

- books;
- plants;
- natural light;
- landscape / study illustrations;
- subtle botanical elements;
- mature badges;
- clean typography.

Avoid:

- cartoon mascots;
- childish stickers;
- overly playful wording.

---

# 26. Neutral Student Dashboard

Reference:

```text
assets/references/teacher-dashboard/student-dashboard-adult-reference-v1.png
```

Use this for the neutral student home screen.

Possible content:

```text
Overall Progress
Current Goal
Recent Progress
Word of the Day
Upcoming Work
Recent Achievements
```

The interface should feel appropriate for both a 16-year-old and a 40-year-old.

---

# 27. Neutral Student Progress

Reference:

```text
assets/references/teacher-dashboard/student-progress-adult-reference-v1.png
```

Important blocks:

```text
Overall Progress
Current Course
Strongest Area
Current Goal
Skills Progress
Unit Progress
Weekly Summary
Recent Activity
```

Progress should feel informative rather than judgmental.

---

# 28. Neutral Student Achievements

Reference:

```text
assets/references/teacher-dashboard/student-achievements-adult-reference-v1.png
```

Achievements should feel like meaningful milestones.

Examples:

```text
Dedicated Learner
Curious Mind
Consistent Learner
Knowledge Seeker
Thoughtful Writer
Rising Explorer
```

Use elegant badge design rather than cartoon stickers.

Possible blocks:

```text
Level / XP
Badges Earned
Milestones Reached
Certificates
Learning Streak
Progress Highlights
```

---

# 29. Gamification Tone

Gamification must adapt to the visual theme.

Child theme:

- playful;
- colorful;
- mascot-friendly.

Neutral theme:

- subtle;
- achievement-oriented;
- elegant.

Do not make adult students feel as if they are using a children's app.

---

# 30. My Learning

Teacher Dashboard includes a personal module:

```text
My Learning
```

This refers to the teacher's own English-learning progress.

It is private and unrelated to student accounts.

Main Teacher Dashboard may include a small preview such as:

```text
Word of the Day
```

Example:

```text
streamline
to make a process simpler and more efficient
```

Possible action:

```text
Add to My Learning
```

---

# 31. Word of the Day

Do not use generic rotating motivational quotes as the main My Learning preview.

Prefer useful learning content such as:

```text
Word of the Day
Phrase of the Day
Current vocabulary
Practice reminder
```

The block is functional, not purely decorative.

---

# 32. Image Upload UX

Where image upload is supported, provide:

- Upload Image button;
- accepted type hint;
- size recommendation;
- preview;
- replace image;
- remove image.

Possible supported formats:

```text
JPG
PNG
WEBP
```

Prefer optimized image sizes.

---

# 33. Image Performance

Images and icons must be optimized.

Use:

- small file sizes;
- appropriate resolution;
- WEBP where practical;
- SVG for lightweight icons.

Avoid unnecessarily heavy GIFs.

Do not make the dashboard slow due to decorative assets.

---

# 34. Assets

Project assets should use:

```text
assets/
```

Suggested structure:

```text
assets/
├── images/
├── icons/
├── avatars/
├── courses/
└── references/
    └── teacher-dashboard/
```

Use clear filenames.

Avoid:

```text
image1.png
final2.png
IMG2044.png
```

---

# 35. Reference Files

Current reference set should include:

```text
teacher-dashboard-main-reference-v2.png
student-profile-teacher-reference-v1.png
quick-update-modal-reference-v1.png
students-list.png
group-page-reference-v1.png
courses-list-reference-v1.png
course-units-reference-v1.png
add-edit-student-modal-reference-v1.png
add-edit-group-modal-reference-v1.png

student-dashboard-reference-v1.png
student-progress-reference-v1.png
student-achievements-reference-v1.png

student-dashboard-adult-reference-v1.png
student-progress-adult-reference-v1.png
student-achievements-adult-reference-v1.png
```

Child and adult/neutral references must not be mixed into one universal student UI.

---

# 36. Reference Priority

When references conflict, use this priority:

1. functionality already defined in `PROJECT_SPEC.md`;
2. existing working Firebase logic;
3. this `VISUAL_SPEC.md`;
4. page-specific reference image;
5. Codex implementation judgment.

Do not sacrifice functionality to copy a visual mockup.

---

# 37. Important Rule for Codex

Reference images are **design references**, not screenshots to reproduce pixel-by-pixel.

Extract:

- hierarchy;
- spacing;
- layout;
- visual language;
- component style;
- atmosphere.

Do not copy incorrect sample data from images.

Do not add functionality solely because a generated reference contains it.

---

# 38. Existing Functionality Must Survive

The visual redesign must not break:

- Firebase Authentication;
- role protection;
- Firestore loading;
- Groups;
- Students;
- Courses;
- Units;
- Student Profile;
- Progress Matrix;
- Current Goal;
- Teacher Observations;
- Quick Update;
- CRUD;
- Security Rules.

---

# 39. Implementation Order

Apply visual redesign in this order:

## Phase 1 — Shared Design System

Create:

- CSS variables;
- typography;
- backgrounds;
- spacing;
- buttons;
- cards;
- form controls;
- status chips;
- modal base;
- table styles.

## Phase 2 — Teacher Shell

Implement:

- sidebar;
- header;
- navigation;
- page container.

## Phase 3 — Teacher Screens

Implement:

- Dashboard;
- Students List;
- Groups;
- Group Page;
- Courses;
- Student Profile;
- Quick Update;
- Add/Edit modals.

## Phase 4 — Child Student Theme

Apply child reference set.

## Phase 5 — Neutral Student Theme

Apply adult/neutral reference set.

## Phase 6 — Responsive / Polish

Check:

- laptop;
- desktop;
- tablet;
- horizontal progress matrix scrolling;
- modal sizing;
- long names;
- many units.

---

# 40. Design Tokens

Prefer CSS variables.

Example:

```css
:root {
  --bg-main: #f8f5ed;
  --bg-card: #fffdf8;
  --text-main: #26352b;
  --text-muted: #6f786f;

  --green-main: #4f7551;
  --green-dark: #365b3b;
  --green-soft: #e9f0e4;

  --lavender-soft: #eee8f7;
  --blue-soft: #e8f0f7;
  --orange-soft: #faeedc;
  --pink-soft: #f7e9ed;

  --border-soft: #e7e0d5;

  --radius-card: 18px;
  --radius-button: 12px;
}
```

Exact values may be adjusted to better match the references.

---

# 41. Typography

Use highly readable web fonts.

Prefer:

- elegant serif for major headings;
- clean sans-serif for interface text.

Do not use decorative fonts for tables/forms.

Typography must remain easy to read at normal laptop sizes.

---

# 42. Accessibility

Maintain:

- sufficient contrast;
- clear focus states;
- keyboard-friendly forms;
- readable font sizes;
- labels for fields;
- icons paired with text when meaning is important.

Do not rely on color alone to communicate status.

---

# 43. Final Goal

The platform should feel like:

**a calm, beautifully organized digital workspace for a teacher, with student experiences that can adapt from playful child-friendly learning to elegant neutral learning for teenagers and adults.**

Functionality first.

Warmth second.

Decoration should support usability, never compete with it.