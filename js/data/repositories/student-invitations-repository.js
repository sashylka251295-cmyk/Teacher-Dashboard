import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { getFirestoreClient } from "../../core/firebase-client.js";
import { COLLECTIONS } from "../collection-names.js";
import { createRepository } from "../firestore-repository.js";

const repository = createRepository(COLLECTIONS.STUDENT_INVITATIONS);

function invitationToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export const studentInvitationsRepository = Object.freeze({
  ...repository,

  listByStudent(studentId) {
    return repository.list(where("studentId", "==", studentId));
  },

  async createForStudent({ studentId, email, name, createdBy }) {
    const database = getFirestoreClient();
    const existing = await repository.list(where("studentId", "==", studentId));
    const token = invitationToken();
    const invitationReference = doc(
      collection(database, COLLECTIONS.STUDENT_INVITATIONS),
      token,
    );
    const batch = writeBatch(database);

    for (const invitation of existing) {
      if (invitation.status === "ready") {
        batch.delete(
          doc(database, COLLECTIONS.STUDENT_INVITATIONS, invitation.id),
        );
      }
    }

    batch.set(invitationReference, {
      studentId,
      email,
      name,
      status: "ready",
      createdBy,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
    return { id: token, studentId, email, name, status: "ready" };
  },

  async claim(invitationId, user) {
    const database = getFirestoreClient();
    const invitationReference = doc(
      database,
      COLLECTIONS.STUDENT_INVITATIONS,
      invitationId,
    );
    const userReference = doc(database, COLLECTIONS.USERS, user.uid);

    await runTransaction(database, async (transaction) => {
      const [invitationSnapshot, userSnapshot] = await Promise.all([
        transaction.get(invitationReference),
        transaction.get(userReference),
      ]);

      if (!invitationSnapshot.exists()) {
        throw new Error("Invitation not found.");
      }
      const currentInvitation = invitationSnapshot.data();
      if (currentInvitation.status !== "ready") {
        throw new Error("This invitation has already been used.");
      }
      if (userSnapshot.exists()) {
        throw new Error("This account already has an access profile.");
      }

      transaction.set(userReference, {
        role: "student",
        studentId: currentInvitation.studentId,
        name: currentInvitation.name,
        email: currentInvitation.email,
        invitationId,
        accessDisabled: false,
      });
      transaction.update(invitationReference, {
        status: "claimed",
        claimedUid: user.uid,
        claimedAt: serverTimestamp(),
      });
    });
  },
});
