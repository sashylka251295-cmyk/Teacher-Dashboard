import { coursesRepository } from "../data/repositories/courses-repository.js";
import { courseProgramPrivateRepository } from "../data/repositories/course-program-private-repository.js";
import { lessonsRepository } from "../data/repositories/lessons-repository.js";
import { unitsRepository } from "../data/repositories/units-repository.js";
import { lessonStopsForUnit } from "../domain/physical-progress.js";

export class CourseProgramInstallError extends Error {}

function requireRecordId(record, label) {
  if (typeof record?.id !== "string" || !record.id.trim()) {
    throw new CourseProgramInstallError(`${label} needs a stable id.`);
  }
  return record.id.trim();
}

function withoutId(record) {
  const copy = structuredClone(record);
  delete copy.id;
  return copy;
}

function assertUniqueIds(records, label) {
  const ids = records.map((record) => requireRecordId(record, label));
  if (new Set(ids).size !== ids.length) {
    throw new CourseProgramInstallError(`${label} ids must be unique.`);
  }
  return ids;
}

export async function installCourseProgram(program) {
  const courseId = requireRecordId(program?.course, "Course");
  const units = Array.isArray(program?.units) ? program.units : [];
  const lessons = Array.isArray(program?.lessons) ? program.lessons : [];
  const unitIds = assertUniqueIds(units, "Unit");
  const lessonIds = assertUniqueIds(lessons, "Lesson");
  const unitIdSet = new Set(unitIds);

  if (units.some((unit) => unit.courseId !== courseId)) {
    throw new CourseProgramInstallError("Every unit must belong to the course being installed.");
  }
  if (lessons.some((lesson) => lesson.courseId !== courseId || !unitIdSet.has(lesson.unitId))) {
    throw new CourseProgramInstallError("Every lesson must belong to an installed course unit.");
  }

  const privateIds = [
    courseProgramPrivateRepository.courseId(courseId),
    ...unitIds.map((unitId) => courseProgramPrivateRepository.unitId(unitId)),
  ];
  const existing = await Promise.all([
    coursesRepository.getById(courseId),
    ...unitIds.map((id) => unitsRepository.getById(id)),
    ...lessonIds.map((id) => lessonsRepository.getById(id)),
    ...privateIds.map((id) => courseProgramPrivateRepository.getById(id)),
  ]);
  if (existing.some(Boolean)) {
    throw new CourseProgramInstallError(
      `${program.course.name || "This course"} already exists or has existing program records. Open it from Courses instead.`,
    );
  }

  let createdCourse = false;
  const createdUnitIds = [];
  const createdLessonIds = [];
  const createdPrivateIds = [];
  try {
    await coursesRepository.createWithId(courseId, withoutId(program.course));
    createdCourse = true;
    for (const unit of units) {
      const unitLessons = lessons.filter((lesson) => lesson.unitId === unit.id);
      await unitsRepository.createWithId(unit.id, {
        ...withoutId(unit),
        lessonStops: lessonStopsForUnit(unit, unitLessons),
      });
      createdUnitIds.push(unit.id);
    }
    for (const lesson of lessons) {
      await lessonsRepository.createWithId(lesson.id, withoutId(lesson));
      createdLessonIds.push(lesson.id);
    }

    const coursePrivateId = courseProgramPrivateRepository.courseId(courseId);
    await courseProgramPrivateRepository.createWithId(coursePrivateId, {
      entityType: "course",
      entityId: courseId,
      teacherNotes: "",
    });
    createdPrivateIds.push(coursePrivateId);
    for (const unitId of unitIds) {
      const privateId = courseProgramPrivateRepository.unitId(unitId);
      await courseProgramPrivateRepository.createWithId(privateId, {
        entityType: "unit",
        entityId: unitId,
        teacherNotes: "",
        moreDetails: {},
      });
      createdPrivateIds.push(privateId);
    }

    return { courseId, unitIds, lessonIds };
  } catch (error) {
    await Promise.all([
      ...createdLessonIds.map((id) => lessonsRepository.remove(id).catch(() => {})),
      ...createdPrivateIds.map((id) => courseProgramPrivateRepository.remove(id).catch(() => {})),
      ...createdUnitIds.map((id) => unitsRepository.remove(id).catch(() => {})),
      createdCourse ? coursesRepository.remove(courseId).catch(() => {}) : Promise.resolve(),
    ]);
    throw error;
  }
}
