import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PAYMENT_TRANSACTION_TYPES,
  buildStudentBillingUpdate,
  buildTransaction,
  calculateStudentBalance,
  effectiveStudentBilling,
  filterPaymentRows,
  formatRubles,
  numericAmount,
  paymentsSummary,
  signedTransactionAmount,
  sortTransactionsNewestFirst,
  validateTransaction,
} from "../js/domain/payments.js";

const payment = (studentId, amount, date = "2026-09-05") => ({
  studentId, amount, date, type: PAYMENT_TRANSACTION_TYPES.PAYMENT,
});
const charge = (studentId, amount, date = "2026-09-05") => ({
  studentId, amount, date, type: PAYMENT_TRANSACTION_TYPES.CHARGE,
});

test("numericAmount accepts decimal commas", () => {
  assert.equal(numericAmount("1250,50"), 1250.5);
});

test("numericAmount rejects missing values", () => {
  assert.equal(Number.isNaN(numericAmount(null)), true);
  assert.equal(Number.isNaN(numericAmount("")), true);
});

test("RUB formatting is centralized and includes the currency symbol", () => {
  assert.match(formatRubles(2000), /2[\s\u00a0\u202f]?000.*₽/);
});

test("positive balances can display an explicit plus sign", () => {
  assert.match(formatRubles(4000, { signed: true }), /^\+/);
});

test("PAYMENT credits the student ledger", () => {
  assert.equal(signedTransactionAmount(payment("a", 2000)), 2000);
});

test("CHARGE debits the student ledger", () => {
  assert.equal(signedTransactionAmount(charge("a", 2000)), -2000);
});

test("ADJUSTMENT supports a credit direction", () => {
  assert.equal(signedTransactionAmount({ type: "ADJUSTMENT", amount: 500, adjustmentDirection: "credit" }), 500);
});

test("ADJUSTMENT defaults to a debit direction", () => {
  assert.equal(signedTransactionAmount({ type: "ADJUSTMENT", amount: 500, adjustmentDirection: "debit" }), -500);
});

test("balance is derived only from one student's ledger", () => {
  assert.equal(calculateStudentBalance([payment("a", 5000), charge("a", 2000), payment("b", 9000)], "a"), 3000);
});

test("student billing override wins over group and student rates", () => {
  const billing = effectiveStudentBilling(
    { groupId: "g", billing: { lessonRate: 2500 }, billingOverride: { lessonRate: 1800 } },
    { billing: { lessonRate: 1400 } },
  );
  assert.deepEqual([billing.lessonRate, billing.rateSource], [1800, "override"]);
});

test("group rate wins when no student override exists", () => {
  const billing = effectiveStudentBilling({ groupId: "g", billing: { lessonRate: 2500 } }, { billing: { lessonRate: 1400 } });
  assert.deepEqual([billing.lessonRate, billing.rateSource], [1400, "group"]);
});

test("individual student rate is used without a group", () => {
  const billing = effectiveStudentBilling({ billing: { lessonRate: 2200, lessonFormat: "individual", standardDuration: 45 } });
  assert.deepEqual([billing.lessonRate, billing.lessonFormat, billing.standardDuration], [2200, "individual", 45]);
});

test("a zero rate is a configured valid rate", () => {
  assert.deepEqual(effectiveStudentBilling({ billing: { lessonRate: 0 } }).lessonRate, 0);
});

test("billing update saves format, duration and an individual rate", () => {
  const update = buildStudentBillingUpdate({ lessonFormat: "individual", standardDuration: 45, lessonRate: 2100 });
  assert.deepEqual(update, {
    billing: { lessonFormat: "individual", standardDuration: 45, lessonRate: 2100 },
    billingOverride: {},
  });
});

test("group billing choice avoids storing a duplicate student rate", () => {
  const update = buildStudentBillingUpdate({ hasGroup: true, useGroupRate: true, lessonFormat: "group", standardDuration: 60, lessonRate: "" });
  assert.deepEqual(update, {
    billing: { lessonFormat: "group", standardDuration: 60, lessonRate: null },
    billingOverride: {},
  });
});

test("missing rate remains not configured", () => {
  assert.equal(effectiveStudentBilling({}).lessonRate, null);
});

test("payment validation rejects zero and negative amounts", () => {
  assert.match(validateTransaction({ studentId: "a", type: "PAYMENT", amount: 0 }), /greater than zero/);
  assert.match(validateTransaction({ studentId: "a", type: "PAYMENT", amount: -1 }), /greater than zero/);
});

test("adjustments require a teacher note", () => {
  assert.match(validateTransaction({ studentId: "a", type: "ADJUSTMENT", adjustmentDirection: "credit", amount: 1, date: "2026-09-05" }), /note is required/i);
});

test("buildTransaction preserves optional future charge references", () => {
  const record = buildTransaction({ studentId: "a", type: "CHARGE", amount: 1000, date: "2026-09-05", lessonEventId: "event", lessonId: "lesson", courseId: "course", unitId: "unit", groupId: "group", attendanceBillingReason: "attended" });
  assert.deepEqual([record.lessonEventId, record.lessonId, record.courseId, record.unitId, record.groupId, record.attendanceBillingReason], ["event", "lesson", "course", "unit", "group", "attended"]);
});

test("payment validation rejects an invalid date", () => {
  assert.match(validateTransaction({ studentId: "a", type: "PAYMENT", amount: 1000, date: "not-a-date" }), /valid date/i);
});

test("monthly summary counts recorded payments and charges only inside the month", () => {
  const summary = paymentsSummary([
    payment("a", 5000, "2026-09-02"), charge("a", 2000, "2026-09-03"), payment("a", 9000, "2026-08-31"),
  ], [{ id: "a" }], new Date(2026, 8, 6));
  assert.deepEqual([summary.received, summary.expected, summary.receivedCount, summary.chargeCount], [5000, 2000, 1, 1]);
});

test("summary outstanding is absolute and credit remains positive", () => {
  const summary = paymentsSummary([charge("a", 2000), payment("b", 4000)], [{ id: "a" }, { id: "b" }], new Date(2026, 8, 6));
  assert.deepEqual([summary.outstanding, summary.credit, summary.outstandingCount, summary.creditCount], [2000, 4000, 1, 1]);
});

test("balance filters distinguish credit, outstanding and zero", () => {
  const rows = [{ student: { name: "A" }, balance: 1 }, { student: { name: "B" }, balance: -1 }, { student: { name: "C" }, balance: 0 }];
  assert.equal(filterPaymentRows(rows, "credit").length, 1);
  assert.equal(filterPaymentRows(rows, "outstanding").length, 1);
  assert.equal(filterPaymentRows(rows, "zero").length, 1);
});

test("student search also matches group names", () => {
  const rows = [{ student: { name: "Alice" }, group: { name: "Owls" }, balance: 0 }];
  assert.equal(filterPaymentRows(rows, "all", "owls").length, 1);
  assert.equal(filterPaymentRows(rows, "all", "bob").length, 0);
});

test("Payments separates online and offline students with online first", () => {
  const rows = [
    { student: { name: "Online", lessonMode: "online" }, balance: 0 },
    { student: { name: "Offline", lessonMode: "offline" }, balance: 0 },
  ];
  assert.deepEqual(filterPaymentRows(rows, "all", "", "online").map((row) => row.student.name), ["Online"]);
  assert.deepEqual(filterPaymentRows(rows, "all", "", "offline").map((row) => row.student.name), ["Offline"]);
});

test("ledger sorts newest transaction first", () => {
  const sorted = sortTransactionsNewestFirst([payment("a", 1, "2026-01-01"), payment("a", 1, "2026-09-01")]);
  assert.equal(sorted[0].date, "2026-09-01");
});

test("admin markup contains the Payments route and no student Payments navigation", () => {
  const admin = readFileSync(new URL("../admin.html", import.meta.url), "utf8");
  const student = readFileSync(new URL("../student.html", import.meta.url), "utf8");
  assert.match(admin, /data-admin-link="payments"/);
  assert.match(admin, /data-admin-section="payments"/);
  assert.doesNotMatch(student, /data-student-link="payments"/);
});

test("Payments defaults to the online student view", () => {
  const admin = readFileSync(new URL("../admin.html", import.meta.url), "utf8");
  const source = readFileSync(new URL("../js/admin/payments.js", import.meta.url), "utf8");
  assert.match(admin, /data-payment-mode="online" aria-pressed="true"[\s\S]*data-payment-mode="offline"/);
  assert.match(source, /let activeMode = "online"/);
});

test("teacher student profiles show the effective rate and ledger balance", () => {
  const admin = readFileSync(new URL("../admin.html", import.meta.url), "utf8");
  const profile = readFileSync(new URL("../js/admin/student-profile.js", import.meta.url), "utf8");
  const student = readFileSync(new URL("../student.html", import.meta.url), "utf8");
  assert.match(admin, /data-profile-billing-rate/);
  assert.match(admin, /data-profile-balance/);
  assert.match(profile, /paymentTransactionsRepository\.listByStudent/);
  assert.match(profile, /effectiveStudentBilling\(student, group\)/);
  assert.doesNotMatch(student, /data-profile-balance/);
});

test("Firestore keeps paymentTransactions teacher-only", () => {
  const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  const paymentRule = rules.slice(rules.indexOf("match /paymentTransactions"), rules.indexOf("match /studentScheduleEntries"));
  assert.match(paymentRule, /allow read, delete: if isAdmin\(\)/);
  assert.doesNotMatch(paymentRule, /isOwnStudent/);
});

test("payment UI does not create automatic calendar charges", () => {
  const source = readFileSync(new URL("../js/admin/payments.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /calendarEventsRepository/);
  assert.match(source, /type: PAYMENT_TRANSACTION_TYPES\.PAYMENT/);
});
