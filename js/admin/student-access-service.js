import { sendPasswordReset } from "../auth/auth-service.js";
import { getAuthClient } from "../core/firebase-client.js";
import { studentInvitationsRepository } from "../data/repositories/student-invitations-repository.js";
import { studentsRepository } from "../data/repositories/students-repository.js";
import { usersRepository } from "../data/repositories/users-repository.js";

function singleLinkedUser(users) {
  if (users.length > 1) {
    throw new Error("This student is linked to multiple accounts.");
  }
  return users[0] ?? null;
}

function readyInvitation(invitations) {
  return invitations.find((invitation) => invitation.status === "ready") ?? null;
}

export async function getStudentAccessStatus(studentId) {
  const [users, invitations] = await Promise.all([
    usersRepository.listByStudent(studentId),
    studentInvitationsRepository.listByStudent(studentId),
  ]);
  const user = singleLinkedUser(users);
  if (user) {
    return {
      state: user.accessDisabled === true ? "access-disabled" : "account-active",
      email: user.email ?? "",
      userId: user.id,
    };
  }

  const invitation = readyInvitation(invitations);
  if (invitation) {
    return {
      state: "invitation-ready",
      email: invitation.email ?? "",
      invitationId: invitation.id,
    };
  }
  return { state: "no-account", email: "" };
}

export async function inviteStudent(studentId, email) {
  const normalizedEmail = email.trim().toLowerCase();
  const [student, users] = await Promise.all([
    studentsRepository.getById(studentId),
    usersRepository.listByStudent(studentId),
  ]);
  if (!student) throw new Error("Student not found.");
  if (singleLinkedUser(users)) {
    throw new Error("This student already has a login account.");
  }

  const invitation = await studentInvitationsRepository.createForStudent({
    studentId,
    email: normalizedEmail,
    name: student.name ?? "Student",
    createdBy: getAuthClient().currentUser?.uid ?? "",
  });
  const setupUrl = new URL("./register.html", document.baseURI);
  setupUrl.searchParams.set("invite", invitation.id);
  return {
    state: "invitation-ready",
    email: normalizedEmail,
    setupLink: setupUrl.href,
  };
}

export async function disableStudentAccess(studentId) {
  const user = singleLinkedUser(await usersRepository.listByStudent(studentId));
  if (!user) throw new Error("This student has no login account.");
  await usersRepository.update(user.id, { accessDisabled: true });
  return { state: "access-disabled", email: user.email ?? "", userId: user.id };
}

export async function enableStudentAccess(studentId) {
  const user = singleLinkedUser(await usersRepository.listByStudent(studentId));
  if (!user) throw new Error("This student has no login account.");
  await usersRepository.update(user.id, { accessDisabled: false });
  return { state: "account-active", email: user.email ?? "", userId: user.id };
}

export async function sendStudentPasswordReset(email) {
  await sendPasswordReset(email);
  return { state: "account-active", email };
}
