import { orderBy, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { COLLECTIONS } from "../collection-names.js?v=20260906-payments";
import { createRepository } from "../firestore-repository.js";
import {
  PAYMENT_ACCOUNT_TYPES,
  PAYMENT_TRANSACTION_TYPES,
  buildTransaction,
  lessonChargeDocumentId,
  transactionMatchesAccount,
} from "../../domain/payments.js?v=20260929-lesson-billing";

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
  async createLessonCharge(input) {
    const id = lessonChargeDocumentId(
      input.accountType,
      input.accountId,
      input.lessonEventId,
      input.lessonOccurrenceKey,
    );
    if (await repository.getById(id)) return id;
    await repository.createWithId(id, firestoreTransaction({
      ...input,
      type: PAYMENT_TRANSACTION_TYPES.CHARGE,
      source: "calendar",
    }));
    return id;
  },
  async listByAccount(accountType, accountId) {
    const transactions = await repository.list(orderBy("date", "desc"));
    return transactions.filter((transaction) => transactionMatchesAccount(transaction, accountType, accountId));
  },
  listByStudent(studentId) {
    return this.listByAccount(PAYMENT_ACCOUNT_TYPES.STUDENT, studentId);
  },
});
