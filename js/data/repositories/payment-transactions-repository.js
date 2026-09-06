import { orderBy, serverTimestamp, Timestamp, where } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { COLLECTIONS } from "../collection-names.js?v=20260906-payments";
import { createRepository } from "../firestore-repository.js";
import { buildTransaction } from "../../domain/payments.js?v=20260906-payments";

const repository = createRepository(COLLECTIONS.PAYMENT_TRANSACTIONS);

function firestoreTransaction(input) {
  const transaction = buildTransaction(input);
  return {
    ...transaction,
    date: Timestamp.fromDate(transaction.date),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export const paymentTransactionsRepository = Object.freeze({
  ...repository,
  createTransaction(input) {
    return repository.create(firestoreTransaction(input));
  },
  listByStudent(studentId) {
    return repository.list(where("studentId", "==", studentId), orderBy("date", "desc"));
  },
});
