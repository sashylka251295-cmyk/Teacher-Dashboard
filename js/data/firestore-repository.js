import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { getFirestoreClient } from "../core/firebase-client.js";

function withId(snapshot) {
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export function createRepository(collectionName) {
  function collectionRef() {
    return collection(getFirestoreClient(), collectionName);
  }

  return Object.freeze({
    async getById(id) {
      return withId(await getDoc(doc(collectionRef(), id)));
    },

    async list(...constraints) {
      const snapshot = await getDocs(query(collectionRef(), ...constraints));
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    },

    async create(data) {
      const created = await addDoc(collectionRef(), data);
      return created.id;
    },

    async createWithId(id, data) {
      await setDoc(doc(collectionRef(), id), data);
      return id;
    },

    async update(id, data) {
      await updateDoc(doc(collectionRef(), id), data);
    },

    async remove(id) {
      await deleteDoc(doc(collectionRef(), id));
    },
  });
}
