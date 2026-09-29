export const PAYMENT_TRANSACTION_TYPES = Object.freeze({
  PAYMENT: "PAYMENT",
  CHARGE: "CHARGE",
  ADJUSTMENT: "ADJUSTMENT",
});

export const PAYMENT_ACCOUNT_TYPES = Object.freeze({
  STUDENT: "student",
  GROUP: "group",
});

export const BILLING_FORMATS = Object.freeze(["individual", "pair", "group"]);
export const BILLING_DURATIONS = Object.freeze([30, 45, 60, 90]);
export const PAYMENT_METHODS = Object.freeze(["bank_transfer", "cash", "other"]);
export const LEGACY_CREDIT_SETTLEMENT_SOURCE = "legacy-credit-settlement";

const RUB_NUMBER = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function numericAmount(value) {
  if (value === null || value === undefined || String(value).trim() === "") return NaN;
  const amount = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(amount) ? amount : NaN;
}

export function paymentAccountKey(accountType, accountId) {
  return `${accountType}:${accountId}`;
}

export function transactionAccount(transaction = {}) {
  if (Object.values(PAYMENT_ACCOUNT_TYPES).includes(transaction.accountType)
    && String(transaction.accountId || "").trim()) {
    return { accountType: transaction.accountType, accountId: String(transaction.accountId) };
  }
  if (String(transaction.studentId || "").trim()) {
    return { accountType: PAYMENT_ACCOUNT_TYPES.STUDENT, accountId: String(transaction.studentId) };
  }
  if (String(transaction.groupId || "").trim()) {
    return { accountType: PAYMENT_ACCOUNT_TYPES.GROUP, accountId: String(transaction.groupId) };
  }
  return null;
}

export function transactionMatchesAccount(transaction, accountType, accountId) {
  const account = transactionAccount(transaction);
  return account?.accountType === accountType && account.accountId === accountId;
}

export function formatRubles(value, { signed = false } = {}) {
  const amount = numericAmount(value);
  if (!Number.isFinite(amount)) return "Not configured";
  const prefix = signed && amount > 0 ? "+" : "";
  return `${prefix}${RUB_NUMBER.format(amount)}`;
}

export function timestampMillis(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  const milliseconds = value instanceof Date ? value.getTime() : new Date(value ?? 0).getTime();
  return Number.isFinite(milliseconds) ? milliseconds : 0;
}

export function signedTransactionAmount(transaction) {
  const amount = numericAmount(transaction?.amount);
  if (!(amount >= 0)) return 0;
  if (transaction?.type === PAYMENT_TRANSACTION_TYPES.PAYMENT) return amount;
  if (transaction?.type === PAYMENT_TRANSACTION_TYPES.CHARGE) return -amount;
  if (transaction?.type === PAYMENT_TRANSACTION_TYPES.ADJUSTMENT) {
    return transaction.adjustmentDirection === "credit" ? amount : -amount;
  }
  return 0;
}

export function calculateAccountBalance(transactions, accountType, accountId) {
  return transactions
    .filter((transaction) => transactionMatchesAccount(transaction, accountType, accountId))
    .reduce((total, transaction) => total + signedTransactionAmount(transaction), 0);
}

export function calculateStudentBalance(transactions, studentId) {
  return calculateAccountBalance(transactions, PAYMENT_ACCOUNT_TYPES.STUDENT, studentId);
}

export function legacyCreditSettlementAmount(transactions, accountType, accountId) {
  const scoped = transactions.filter((transaction) =>
    transactionMatchesAccount(transaction, accountType, accountId));
  if (scoped.some(({ source }) => source === LEGACY_CREDIT_SETTLEMENT_SOURCE)) return 0;

  // Payments saved by the old screen have a studentId, but no explicit billing account.
  // New payments always include accountType/accountId and remain available as real credit.
  const legacyPayments = scoped
    .filter((transaction) => transaction.type === PAYMENT_TRANSACTION_TYPES.PAYMENT
      && !transaction.accountType
      && !transaction.accountId)
    .reduce((total, transaction) => total + Math.max(0, numericAmount(transaction.amount) || 0), 0);
  if (legacyPayments <= 0) return 0;

  const existingDebits = scoped.reduce((total, transaction) => {
    const signedAmount = signedTransactionAmount(transaction);
    return signedAmount < 0 ? total + Math.abs(signedAmount) : total;
  }, 0);
  const unusedLegacyCredit = Math.max(0, legacyPayments - existingDebits);
  const currentCredit = Math.max(0, calculateAccountBalance(scoped, accountType, accountId));
  return Math.round(Math.min(unusedLegacyCredit, currentCredit) * 100) / 100;
}

export function effectiveStudentBilling(student = {}, group = null) {
  const override = numericAmount(student.billingOverride?.lessonRate);
  const studentRate = numericAmount(student.billing?.lessonRate);
  const hasOverride = Number.isFinite(override) && override >= 0;
  const hasStudentRate = Number.isFinite(studentRate) && studentRate >= 0;
  const rate = hasStudentRate ? studentRate : hasOverride ? override : null;
  const source = hasStudentRate ? "student" : hasOverride ? "override" : "none";
  const format = BILLING_FORMATS.includes(student.billing?.lessonFormat)
    ? student.billing.lessonFormat
    : student.groupId ? "group" : "individual";
  const duration = BILLING_DURATIONS.includes(Number(student.billing?.standardDuration))
    ? Number(student.billing.standardDuration)
    : 60;
  return { lessonRate: rate, rateSource: source, lessonFormat: format, standardDuration: duration };
}

export function effectiveGroupBilling(group = {}) {
  const rate = numericAmount(group.billing?.lessonRate);
  const duration = BILLING_DURATIONS.includes(Number(group.billing?.standardDuration))
    ? Number(group.billing.standardDuration)
    : 60;
  return {
    lessonRate: Number.isFinite(rate) && rate >= 0 ? rate : null,
    rateSource: Number.isFinite(rate) && rate >= 0 ? "group" : "none",
    lessonFormat: "group",
    standardDuration: duration,
  };
}

export function buildStudentBillingUpdate({
  currentBilling = {},
  lessonFormat,
  standardDuration,
  lessonRate,
}) {
  const duration = Number(standardDuration);
  const rate = numericAmount(lessonRate);
  if (!BILLING_FORMATS.includes(lessonFormat) || !BILLING_DURATIONS.includes(duration)) {
    throw new Error("Select a valid format and duration.");
  }
  if (!(rate >= 0) || !Number.isFinite(rate)) {
    throw new Error("Enter a lesson rate of zero or more.");
  }
  return {
    billing: {
      ...currentBilling,
      lessonFormat,
      standardDuration: duration,
      lessonRate: rate,
    },
    billingOverride: {},
  };
}

export function buildGroupBillingUpdate({ currentBilling = {}, standardDuration, lessonRate }) {
  const duration = Number(standardDuration);
  const rate = numericAmount(lessonRate);
  if (!BILLING_DURATIONS.includes(duration)) throw new Error("Select a valid duration.");
  if (!(rate >= 0) || !Number.isFinite(rate)) throw new Error("Enter a lesson rate of zero or more.");
  return { billing: { ...currentBilling, standardDuration: duration, lessonRate: rate } };
}

function normalizedInputAccount(input = {}) {
  const explicitType = input.accountType;
  const explicitId = String(input.accountId || "").trim();
  if (Object.values(PAYMENT_ACCOUNT_TYPES).includes(explicitType) && explicitId) {
    return { accountType: explicitType, accountId: explicitId };
  }
  if (String(input.studentId || "").trim()) {
    return { accountType: PAYMENT_ACCOUNT_TYPES.STUDENT, accountId: String(input.studentId).trim() };
  }
  if (String(input.groupId || "").trim()) {
    return { accountType: PAYMENT_ACCOUNT_TYPES.GROUP, accountId: String(input.groupId).trim() };
  }
  return null;
}

export function validateTransaction(input) {
  const type = input?.type;
  const amount = numericAmount(input?.amount);
  if (!Object.values(PAYMENT_TRANSACTION_TYPES).includes(type)) return "Select a valid transaction type.";
  if (!(amount > 0)) return "Enter an amount greater than zero.";
  if (!normalizedInputAccount(input)) return "Select a billing account.";
  const date = input?.date instanceof Date ? input.date : new Date(input?.date);
  if (Number.isNaN(date.getTime())) return "Select a valid date.";
  if (type === PAYMENT_TRANSACTION_TYPES.ADJUSTMENT) {
    if (!["credit", "debit"].includes(input?.adjustmentDirection)) return "Select an adjustment direction.";
    if (!String(input?.note ?? "").trim()) return "A note is required for an adjustment.";
  }
  return "";
}

export function buildTransaction(input, now = new Date()) {
  const error = validateTransaction(input);
  if (error) throw new Error(error);
  const account = normalizedInputAccount(input);
  const allocations = Array.isArray(input.allocations)
    ? input.allocations.map((allocation) => ({
      chargeId: String(allocation?.chargeId || "").trim(),
      amount: numericAmount(allocation?.amount),
    })).filter(({ chargeId, amount }) => chargeId && amount > 0)
    : [];
  return {
    accountType: account.accountType,
    accountId: account.accountId,
    ...(account.accountType === PAYMENT_ACCOUNT_TYPES.STUDENT ? { studentId: account.accountId } : {}),
    ...(account.accountType === PAYMENT_ACCOUNT_TYPES.GROUP ? { groupId: account.accountId } : {}),
    type: input.type,
    amount: numericAmount(input.amount),
    date: input.date instanceof Date ? input.date : new Date(input.date),
    source: String(input.source || "manual"),
    paymentMethod: input.paymentMethod || "",
    note: String(input.note ?? "").trim(),
    ...(allocations.length ? { allocations } : {}),
    ...(input.type === PAYMENT_TRANSACTION_TYPES.ADJUSTMENT
      ? { adjustmentDirection: input.adjustmentDirection }
      : {}),
    ...(input.lessonEventId ? { lessonEventId: input.lessonEventId } : {}),
    ...(input.lessonOccurrenceKey ? { lessonOccurrenceKey: input.lessonOccurrenceKey } : {}),
    ...(input.lessonLabel ? { lessonLabel: String(input.lessonLabel).trim() } : {}),
    ...(input.lessonId ? { lessonId: input.lessonId } : {}),
    ...(input.courseId ? { courseId: input.courseId } : {}),
    ...(input.unitId ? { unitId: input.unitId } : {}),
    ...(input.groupId ? { groupId: input.groupId } : {}),
    ...(input.attendanceBillingReason ? { attendanceBillingReason: input.attendanceBillingReason } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export function lessonChargeDocumentId(accountType, accountId, lessonEventId, occurrenceKey) {
  return ["lesson-charge", accountType, accountId, lessonEventId, occurrenceKey]
    .map((part) => encodeURIComponent(String(part || "")))
    .join("__");
}

export function legacyCreditSettlementDocumentId(accountType, accountId) {
  return [LEGACY_CREDIT_SETTLEMENT_SOURCE, "2026-09-29", accountType, accountId]
    .map((part) => encodeURIComponent(String(part || "")))
    .join("__");
}

export function accountTransactions(transactions, accountType, accountId) {
  return transactions.filter((transaction) => transactionMatchesAccount(transaction, accountType, accountId));
}

export function accountLessonPaymentStates(transactions, accountType, accountId) {
  const scoped = accountTransactions(transactions, accountType, accountId);
  const charges = scoped
    .filter(({ type }) => type === PAYMENT_TRANSACTION_TYPES.CHARGE)
    .sort((first, second) => {
      const dateDifference = timestampMillis(first.date ?? first.createdAt) - timestampMillis(second.date ?? second.createdAt);
      if (dateDifference) return dateDifference;
      return String(first.lessonOccurrenceKey ?? first.id).localeCompare(String(second.lessonOccurrenceKey ?? second.id));
    });
  const explicit = new Map();
  let availableCredit = 0;
  scoped.filter(({ type }) => type === PAYMENT_TRANSACTION_TYPES.PAYMENT).forEach((payment) => {
    const amount = numericAmount(payment.amount);
    const allocations = Array.isArray(payment.allocations) ? payment.allocations : [];
    let remainingPayment = Math.max(0, amount);
    allocations.forEach((allocation) => {
      const allocationAmount = numericAmount(allocation?.amount);
      const chargeId = String(allocation?.chargeId || "");
      if (!(allocationAmount > 0) || !chargeId || remainingPayment <= 0) return;
      const appliedAmount = Math.min(allocationAmount, remainingPayment);
      explicit.set(chargeId, (explicit.get(chargeId) || 0) + appliedAmount);
      remainingPayment -= appliedAmount;
    });
    availableCredit += remainingPayment;
  });
  const states = new Map();
  charges.forEach((charge) => {
    const amount = numericAmount(charge.amount);
    let paidAmount = Math.min(amount, explicit.get(charge.id) || 0);
    const automatic = Math.min(Math.max(0, amount - paidAmount), availableCredit);
    paidAmount += automatic;
    availableCredit -= automatic;
    const outstandingAmount = Math.max(0, amount - paidAmount);
    states.set(charge.id, {
      charge,
      paidAmount,
      outstandingAmount,
      status: outstandingAmount <= 0.005 ? "paid" : paidAmount > 0 ? "partial" : "unpaid",
    });
  });
  return states;
}

export function billingTargetsForCalendarOccurrence(occurrence, students = [], groups = []) {
  if (!occurrence) return [];
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  if (occurrence.participantType === PAYMENT_ACCOUNT_TYPES.STUDENT) {
    const student = students.find(({ id }) => id === occurrence.studentId);
    if (!student) return [];
    const group = groupsById.get(student.groupId) ?? null;
    const billing = effectiveStudentBilling(student, group);
    return [{
      accountType: PAYMENT_ACCOUNT_TYPES.STUDENT,
      accountId: student.id,
      accountName: student.name || occurrence.displayName || "Student",
      lessonRate: billing.lessonRate,
    }];
  }
  if (occurrence.participantType !== PAYMENT_ACCOUNT_TYPES.GROUP) return [];
  const group = groupsById.get(occurrence.groupId);
  if (!group) return [];
  if (group.lessonMode === "offline") {
    return [{
      accountType: PAYMENT_ACCOUNT_TYPES.GROUP,
      accountId: group.id,
      accountName: group.name || occurrence.displayName || "Group",
      lessonRate: effectiveGroupBilling(group).lessonRate,
    }];
  }
  return students.filter((student) => student.groupId === group.id).map((student) => ({
    accountType: PAYMENT_ACCOUNT_TYPES.STUDENT,
    accountId: student.id,
    accountName: student.name || "Student",
    lessonRate: effectiveStudentBilling(student, group).lessonRate,
  }));
}

export function lessonChargeForTarget(transactions, occurrence, target) {
  return transactions.find((transaction) => transaction.type === PAYMENT_TRANSACTION_TYPES.CHARGE
    && transaction.lessonEventId === occurrence.id
    && transaction.lessonOccurrenceKey === occurrence.occurrenceKey
    && transactionMatchesAccount(transaction, target.accountType, target.accountId)) ?? null;
}

export function lessonPaymentSummary(occurrence, transactions, students = [], groups = []) {
  if (occurrence?.status !== "completed") return null;
  const targets = billingTargetsForCalendarOccurrence(occurrence, students, groups);
  if (!targets.length) return null;
  const results = targets.map((target) => {
    if (target.lessonRate === 0) return { target, status: "paid", paidAmount: 0, outstandingAmount: 0 };
    const charge = lessonChargeForTarget(transactions, occurrence, target);
    if (!charge) return {
      target,
      status: target.lessonRate === null ? "rate-missing" : "unpaid",
      paidAmount: 0,
      outstandingAmount: target.lessonRate,
    };
    const state = accountLessonPaymentStates(transactions, target.accountType, target.accountId).get(charge.id);
    return { target, ...(state ?? { status: "unpaid", paidAmount: 0, outstandingAmount: charge.amount }) };
  });
  const paidCount = results.filter(({ status }) => status === "paid").length;
  const missingCount = results.filter(({ status }) => status === "rate-missing").length;
  const partialCount = results.filter(({ status }) => status === "partial").length;
  const status = paidCount === results.length ? "paid"
    : missingCount === results.length ? "rate-missing"
      : paidCount > 0 || partialCount > 0 ? "partial" : "unpaid";
  return {
    status,
    label: status === "paid" ? "Paid"
      : status === "partial" ? "Partly paid"
        : status === "rate-missing" ? "Rate missing" : "Unpaid",
    paidCount,
    totalCount: results.length,
    results,
  };
}

export function paymentsSummary(transactions, accounts, referenceDate = new Date()) {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1).getTime();
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1).getTime();
  const thisMonth = transactions.filter((transaction) => {
    const time = timestampMillis(transaction.date ?? transaction.createdAt);
    return time >= start && time < end;
  });
  const balances = accounts.map((account) => calculateAccountBalance(
    transactions,
    account.accountType ?? PAYMENT_ACCOUNT_TYPES.STUDENT,
    account.accountId ?? account.id,
  ));
  return {
    received: thisMonth.filter(({ type }) => type === PAYMENT_TRANSACTION_TYPES.PAYMENT)
      .reduce((sum, transaction) => sum + numericAmount(transaction.amount), 0),
    receivedCount: thisMonth.filter(({ type }) => type === PAYMENT_TRANSACTION_TYPES.PAYMENT).length,
    expected: thisMonth.filter(({ type }) => type === PAYMENT_TRANSACTION_TYPES.CHARGE)
      .reduce((sum, transaction) => sum + numericAmount(transaction.amount), 0),
    chargeCount: thisMonth.filter(({ type }) => type === PAYMENT_TRANSACTION_TYPES.CHARGE).length,
    outstanding: Math.abs(balances.filter((balance) => balance < 0).reduce((sum, balance) => sum + balance, 0)),
    outstandingCount: balances.filter((balance) => balance < 0).length,
    credit: balances.filter((balance) => balance > 0).reduce((sum, balance) => sum + balance, 0),
    creditCount: balances.filter((balance) => balance > 0).length,
  };
}

export function filterPaymentRows(rows, filter = "all", search = "", lessonMode = "all") {
  const term = search.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    const balanceMatches = filter === "credit" ? row.balance > 0
      : filter === "outstanding" ? row.balance < 0
        : filter === "zero" ? row.balance === 0 : true;
    const searchMatches = !term || [row.accountName, row.student?.name, row.group?.name]
      .some((value) => String(value ?? "").toLocaleLowerCase().includes(term));
    const rowMode = row.lessonMode ?? (row.student?.lessonMode === "offline" ? "offline" : "online");
    const modeMatches = lessonMode === "all" || rowMode === lessonMode;
    return balanceMatches && searchMatches && modeMatches;
  });
}

export function sortTransactionsNewestFirst(transactions) {
  return [...transactions].sort((first, second) =>
    timestampMillis(second.date ?? second.createdAt) - timestampMillis(first.date ?? first.createdAt));
}
