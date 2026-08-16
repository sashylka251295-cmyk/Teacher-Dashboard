import {
  createUserWithEmailAndPassword,
  getIdToken,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import { getAuthClient } from "../core/firebase-client.js";

export function signIn(email, password) {
  return signInWithEmailAndPassword(getAuthClient(), email, password);
}

export function createStudentAccount(email, password) {
  return createUserWithEmailAndPassword(getAuthClient(), email, password);
}

export function sendVerificationEmail(user) {
  return sendEmailVerification(user);
}

export function sendPasswordReset(email) {
  return sendPasswordResetEmail(getAuthClient(), email);
}

export async function refreshAuthUser(user) {
  await reload(user);
  await getIdToken(user, true);
  return user;
}

export function signOutCurrentUser() {
  return signOut(getAuthClient());
}

export function waitForAuthUser() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      getAuthClient(),
      (user) => {
        unsubscribe();
        resolve(user);
      },
      (error) => {
        unsubscribe();
        reject(error);
      },
    );
  });
}
