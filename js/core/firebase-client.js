import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { firebaseConfig, isFirebaseConfigured } from "../firebase-config.js";

function getFirebaseApp() {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Update js/firebase-config.js.");
  }

  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export function getAuthClient() {
  return getAuth(getFirebaseApp());
}

export function getFirestoreClient() {
  return getFirestore(getFirebaseApp());
}
