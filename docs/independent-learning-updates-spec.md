# Independent Learning Updates

## Purpose

An individual student may study outside a configured textbook course. The teacher must still be able to record meaningful learning progress without creating a placeholder Course, Unit, or Lesson.

## Workflow

1. Open the student profile and choose **Quick Update**.
2. Select **Independent update — no course**. It is selected automatically when the student has no course.
3. Choose the lesson date.
4. Add one or more learning objectives and assign each a language skill category.
5. Select the objectives actually worked on. A status remains optional.
6. Optionally add homework, a private observation, published feedback, or a goal update.
7. Save the update.

## Data behaviour

- Independent history records use `scope: "independent"` and empty `courseId`, `unitId`, and `lessonId` values.
- Objective status documents use a stable `__independent__` storage key while retaining an empty public `unitId`.
- Safe current target fields are copied to `students/{studentId}.independentLearning`; private observation text is never copied there.
- Independent updates do not change `courseJourney` or physical course-completion percentages.
- Independent updates can be edited or deleted through the existing progress-history editor.
- Course-based and independent progress remain distinct.

## Student setup

Course selection is optional for an individual student. A student without a course is labelled **Independent learning** in teacher and student interfaces.

