import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { getFirestoreClient } from "../../core/firebase-client.js";
import { normalizeFeedbackContent } from "../../domain/feedback.js?v=20260827-profile-hotfix";
import { COLLECTIONS } from "../collection-names.js";
import { createRepository } from "../firestore-repository.js";

const repository = createRepository(COLLECTIONS.FEEDBACK_DRAFTS);

export const feedbackDraftsRepository = Object.freeze({
  ...repository,
  listByStudent(studentId) {
    return repository.list(where("studentId", "==", studentId));
  },
  listWaiting() {
    return repository.list(where("status", "==", "draft"));
  },
  createDraft({ studentId, courseId, sourceObservationIds, content, generator }) {
    const now = serverTimestamp();
    return repository.create({
      studentId,
      courseId,
      sourceObservationIds: [...sourceObservationIds],
      content: normalizeFeedbackContent(content),
      generator,
      status: "draft",
      latestVersionNumber: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
  createProgressDraft({
    studentId,
    courseId,
    unitId,
    lessonId,
    progressHistoryId,
    learningTargetIds = [],
    content,
  }) {
    const now = serverTimestamp();
    return repository.create({
      studentId,
      courseId,
      unitId,
      lessonId,
      progressHistoryId,
      learningTargetIds: [...new Set(learningTargetIds)],
      sourceObservationIds: [],
      content: normalizeFeedbackContent(content),
      generator: "teacher-written",
      source: "progress_update",
      status: "draft",
      latestVersionNumber: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
  saveDraft(id, content) {
    return repository.update(id, {
      content: normalizeFeedbackContent(content),
      status: "draft",
      updatedAt: serverTimestamp(),
    });
  },
  saveProgressDraft(id, {
    courseId,
    unitId,
    lessonId,
    learningTargetIds = [],
    content,
  }) {
    return repository.update(id, {
      courseId,
      unitId,
      lessonId,
      learningTargetIds: [...new Set(learningTargetIds)],
      content: normalizeFeedbackContent(content),
      status: "draft",
      updatedAt: serverTimestamp(),
    });
  },
  prepareRepublish(id) {
    return repository.update(id, { status: "draft", updatedAt: serverTimestamp() });
  },
  archive(id) {
    return repository.update(id, { status: "archived", updatedAt: serverTimestamp() });
  },
  async removeWithPublishedVersions(id) {
    const firestore = getFirestoreClient();
    const versionsSnapshot = await getDocs(query(
      collection(firestore, COLLECTIONS.FEEDBACK_VERSIONS),
      where("feedbackId", "==", id),
    ));
    if (versionsSnapshot.size > 499) {
      throw new Error("This feedback has too many published versions to delete safely.");
    }
    const batch = writeBatch(firestore);
    versionsSnapshot.docs.forEach((version) => batch.delete(version.ref));
    batch.delete(doc(firestore, COLLECTIONS.FEEDBACK_DRAFTS, id));
    await batch.commit();
    return { deletedVersions: versionsSnapshot.size };
  },
  async publish(id, content) {
    const firestore = getFirestoreClient();
    const draftRef = doc(firestore, COLLECTIONS.FEEDBACK_DRAFTS, id);
    const versionRef = doc(collection(firestore, COLLECTIONS.FEEDBACK_VERSIONS));
    const normalizedContent = normalizeFeedbackContent(content);

    return runTransaction(firestore, async (transaction) => {
      const draftSnapshot = await transaction.get(draftRef);
      if (!draftSnapshot.exists()) throw new Error("Feedback draft not found.");
      const draft = draftSnapshot.data();
      if (draft.status !== "draft") throw new Error("Only a reviewed draft can be published.");
      const versionNumber = (Number(draft.latestVersionNumber) || 0) + 1;
      const publishedAt = serverTimestamp();
      transaction.set(versionRef, {
        feedbackId: id,
        studentId: draft.studentId,
        courseId: draft.courseId,
        unitId: draft.unitId ?? "",
        lessonId: draft.lessonId ?? "",
        progressHistoryId: draft.progressHistoryId ?? "",
        learningTargetIds: [...(draft.learningTargetIds ?? [])],
        sourceObservationIds: [...(draft.sourceObservationIds ?? [])],
        content: normalizedContent,
        status: "published",
        versionNumber,
        publishedAt,
      });
      transaction.update(draftRef, {
        content: normalizedContent,
        status: "published",
        latestVersionNumber: versionNumber,
        latestPublishedVersionId: versionRef.id,
        publishedAt,
        updatedAt: publishedAt,
      });
      return { versionId: versionRef.id, versionNumber };
    });
  },
});
