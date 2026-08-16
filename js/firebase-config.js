export const firebaseConfig = Object.freeze({
  apiKey: "AIzaSyDAZbtFiFBmn-kVq_rB6t7HeVV_SM8PE2A",
  authDomain: "teacherdashboard-70051.firebaseapp.com",
  projectId: "teacherdashboard-70051",
  storageBucket: "teacherdashboard-70051.firebasestorage.app",
  messagingSenderId: "262727056449",
  appId: "1:262727056449:web:2eabb7975db94288a19ac0"
});

export function isFirebaseConfigured() {
  return Object.values(firebaseConfig).every(
    (value) => typeof value === "string" && !value.startsWith("REPLACE_WITH_"),
  );
}

