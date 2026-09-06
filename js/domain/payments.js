export const PAYMENT_TRANSACTION_TYPES = Object.freeze({
  PAYMENT: "PAYMENT",
  CHARGE: "CHARGE",
  ADJUSTMENT: "ADJUSTMENT",
});

export const BILLING_FORMATS = Object.freeze(["individual", "pair", "group"]);
export const BILLING_DURATIONS = Object.freeze([30, 45, 60, 90]);
export const PAYMENT_METHODS = Object.freeze(["bank_transfer", "cash", "other"]);

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

export function calculateStudentBalance(transactions, studentId) {
  return transactions
    .filter((transaction) => transaction.studentId === studentId)
    .reduce((total, transaction) => total + signedTransactionAmount(transaction), 0);
}

export function effectiveStudentBilling(student = {}, group = null) {
  const override = numericAmount(student.billingOverride?.lessonRate);
  const studentRate = numericAmount(student.billing?.lessonRate);
  const groupRate = numericAmount(group?.billing?.lessonRate);
  const hasOverride = Number.isFinite(override) && override >= 0;
  const hasGroupRate = Number.isFinite(groupRate) && groupRate >= 0;
  const hasStudentRate = Number.isFinite(studentRate) && studentRate >= 0;
  const rate = hasOverride ? override : hasGroupRate ? groupRate : hasStudentRate ? studentRate : null;
  const source = hasOverride ? "override" : hasGroupRate ? "group" : hasStudentRate ? "student" : "none";
  const format = BILLING_FORMATS.includes(student.billing?.lessonFormat)
    ? student.billing.lessonFormat
    : student.groupId ? "group" : "individual";
  const duration = BILLING_DURATIONS.includes(Number(student.billing?.standardDuration))
    ? Number(student.billing.standardDuration)
    : 60;
  return { lessonRate: rate, rateSource: source, lessonFormat: format, standardDuration: duration };
}

export function buildStudentBillingUpdate({
  currentBilling = {},
  hasGroup = false,
  useGroupRate = false,
  lessonFormat,
  standardDuration,
  lessonRate,
}) {
  const duration = Number(standardDuration);
  const rate = numericAmount(lessonRate);
  if (!BILLING_FORMATS.includes(lessonFormat) || !BILLING_DURATIONS.includes(duration)) {
    throw new Error("Select a valid format and duration.");
  }
  if (!(hasGroup && useGroupRate) && (!(rate >= 0) || !Number.isFinite(rate))) {
    throw new Error("Enter a lesson rate of zero or more.");
  }
  return {
    billing: {
      ...currentBilling,
      lessonFormat,
      standardDuration: duration,
      lessonRate: hasGroup ? null : rate,
    },
    billingOverride: hasGroup && !useGroupRate ? { lessonRate: rate } : {},
  };
}

export function validateTransaction(input) {
  const type = input?.type;
  const amount = numericAmount(input?.amount);
  if (!Object.values(PAYMENT_TRANSACTION_TYPES).includes(type)) return "Select a valid transaction type.";
  if (!(amount > 0)) return "Enter an amount greater than zero.";
  if (!String(input?.studentId ?? "").trim()) return "Select a student.";
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
  return {
    studentId: String(input.studentId),
    type: input.type,
    amount: numericAmount(input.amount),
    date: input.date instanceof Date ? input.date : new Date(input.date),
    source: String(input.source || "manual"),
    paymentMethod: input.paymentMethod || "",
    note: String(input.note ?? "").trim(),
    ...(input.type === PAYMENT_TRANSACTION_TYPES.ADJUSTMENT
      ? { adjustmentDirection: input.adjustmentDirection }
      : {}),
    ...(input.lessonEventId ? { lessonEventId: input.lessonEventId } : {}),
    ...(input.lessonId ? { lessonId: input.lessonId } : {}),
    ...(input.courseId ? { courseId: input.courseId } : {}),
    ...(input.unitId ? { unitId: input.unitId } : {}),
    ...(input.groupId ? { groupId: input.groupId } : {}),
    ...(input.attendanceBillingReason ? { attendanceBillingReason: input.attendanceBillingReason } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export function paymentsSummary(transactions, students, referenceDate = new Date()) {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1).getTime();
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1).getTime();
  const thisMonth = transactions.filter((transaction) => {
    const time = timestampMillis(transaction.date ?? transaction.createdAt);
    return time >= start && time < end;
  });
  const balances = students.map((student) => calculateStudentBalance(transactions, student.id));
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

export function filterPaymentRows(rows, filter = "all", search = "") {
  const term = search.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    const balanceMatches = filter === "credit" ? row.balance > 0
      : filter === "outstanding" ? row.balance < 0
        : filter === "zero" ? row.balance === 0 : true;
    const searchMatches = !term || [row.student.name, row.group?.name]
      .some((value) => String(value ?? "").toLocaleLowerCase().includes(term));
    return balanceMatches && searchMatches;
  });
}

export function sortTransactionsNewestFirst(transactions) {
  return [...transactions].sort((first, second) =>
    timestampMillis(second.date ?? second.createdAt) - timestampMillis(first.date ?? first.createdAt));
}
