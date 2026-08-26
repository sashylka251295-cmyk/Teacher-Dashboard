import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  where,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { getFirestoreClient } from "../../core/firebase-client.js";
import { normalizeFeedbackContent } from "../../domain/feedback.js";
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
  saveDraft(id, content) {
    return repository.update(id, {
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
