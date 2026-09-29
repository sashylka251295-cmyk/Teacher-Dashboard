import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PAYMENT_ACCOUNT_TYPES,
  PAYMENT_TRANSACTION_TYPES,
  accountLessonPaymentStates,
  billingTargetsForCalendarOccurrence,
  buildGroupBillingUpdate,
  buildStudentBillingUpdate,
  buildTransaction,
  calculateAccountBalance,
  calculateStudentBalance,
  effectiveGroupBilling,
  effectiveStudentBilling,
  filterPaymentRows,
  formatRubles,
  lessonPaymentSummary,
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

test("a student's fixed rate wins over legacy override and group rates", () => {
  const billing = effectiveStudentBilling(
    { groupId: "g", billing: { lessonRate: 2500 }, billingOverride: { lessonRate: 1800 } },
    { billing: { lessonRate: 1400 } },
  );
  assert.deepEqual([billing.lessonRate, billing.rateSource], [2500, "student"]);
});

test("a group rate never replaces a student's missing fixed rate", () => {
  const billing = effectiveStudentBilling({ groupId: "g", billing: { lessonRate: null } }, { billing: { lessonRate: 1400 } });
  assert.deepEqual([billing.lessonRate, billing.rateSource], [null, "none"]);
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

test("grouped online students still store their own fixed rate", () => {
  const update = buildStudentBillingUpdate({ hasGroup: true, lessonFormat: "group", standardDuration: 60, lessonRate: 1900 });
  assert.deepEqual(update, {
    billing: { lessonFormat: "group", standardDuration: 60, lessonRate: 1900 },
    billingOverride: {},
  });
});

test("offline groups keep one shared fixed rate", () => {
  assert.deepEqual(buildGroupBillingUpdate({ standardDuration: 60, lessonRate: 5000 }), {
    billing: { standardDuration: 60, lessonRate: 5000 },
  });
  assert.equal(effectiveGroupBilling({ billing: { lessonRate: 5000 } }).lessonRate, 5000);
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

test("group payments belong to one group billing account", () => {
  const transaction = buildTransaction({
    accountType: PAYMENT_ACCOUNT_TYPES.GROUP,
    accountId: "group-a",
    type: "PAYMENT",
    amount: 6000,
    date: "2026-09-05",
  });
  assert.deepEqual([transaction.accountType, transaction.accountId, transaction.groupId], ["group", "group-a", "group-a"]);
  assert.equal(calculateAccountBalance([{ ...transaction, id: "payment" }], "group", "group-a"), 6000);
});

test("offline group lessons create one group target while online groups charge each student", () => {
  const occurrence = { participantType: "group", groupId: "g", displayName: "Group", id: "event", occurrenceKey: "2026-09-05" };
  const students = [
    { id: "a", groupId: "g", name: "Alice", billing: { lessonRate: 1500 } },
    { id: "b", groupId: "g", name: "Bob", billing: { lessonRate: 1700 } },
  ];
  const offline = billingTargetsForCalendarOccurrence(occurrence, students, [{ id: "g", lessonMode: "offline", billing: { lessonRate: 5000 } }]);
  const online = billingTargetsForCalendarOccurrence(occurrence, students, [{ id: "g", lessonMode: "online", billing: { lessonRate: 4000 } }]);
  assert.deepEqual(offline.map(({ accountType, accountId, lessonRate }) => [accountType, accountId, lessonRate]), [["group", "g", 5000]]);
  assert.deepEqual(online.map(({ accountType, accountId, lessonRate }) => [accountType, accountId, lessonRate]), [["student", "a", 1500], ["student", "b", 1700]]);
});

test("one advance payment covers several completed lessons in account order", () => {
  const transactions = [
    { id: "c1", accountType: "student", accountId: "a", studentId: "a", type: "CHARGE", amount: 2000, date: "2026-09-01" },
    { id: "c2", accountType: "student", accountId: "a", studentId: "a", type: "CHARGE", amount: 2000, date: "2026-09-08" },
    { id: "p1", accountType: "student", accountId: "a", studentId: "a", type: "PAYMENT", amount: 5000, date: "2026-08-30" },
  ];
  const states = accountLessonPaymentStates(transactions, "student", "a");
  assert.equal(states.get("c1").status, "paid");
  assert.equal(states.get("c2").status, "paid");
  assert.equal(calculateAccountBalance(transactions, "student", "a"), 1000);
});

test("an explicitly allocated payment marks its completed calendar lesson paid", () => {
  const occurrence = { id: "event", occurrenceKey: "2026-09-05", status: "completed", participantType: "student", studentId: "a" };
  const charge = { id: "charge", accountType: "student", accountId: "a", studentId: "a", type: "CHARGE", amount: 2000, date: "2026-09-05", lessonEventId: "event", lessonOccurrenceKey: "2026-09-05" };
  const paymentRecord = { id: "payment", accountType: "student", accountId: "a", studentId: "a", type: "PAYMENT", amount: 2000, date: "2026-09-05", allocations: [{ chargeId: "charge", amount: 2000 }] };
  const summary = lessonPaymentSummary(occurrence, [charge, paymentRecord], [{ id: "a", billing: { lessonRate: 2000 } }], []);
  assert.deepEqual([summary.status, summary.label], ["paid", "Paid"]);
});

test("lesson allocations can never spend more than the payment amount", () => {
  const transactions = [
    { id: "c1", studentId: "a", type: "CHARGE", amount: 2000, date: "2026-09-01" },
    { id: "c2", studentId: "a", type: "CHARGE", amount: 2000, date: "2026-09-08" },
    { id: "p1", studentId: "a", type: "PAYMENT", amount: 2500, date: "2026-09-09", allocations: [{ chargeId: "c1", amount: 2000 }, { chargeId: "c2", amount: 2000 }] },
  ];
  const states = accountLessonPaymentStates(transactions, "student", "a");
  assert.equal(states.get("c1").status, "paid");
  assert.equal(states.get("c2").paidAmount, 500);
  assert.equal(states.get("c2").status, "partial");
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

test("lesson billing cache version reaches payments, profiles and student editing", () => {
  const admin = readFileSync(new URL("../admin.html", import.meta.url), "utf8");
  const page = readFileSync(new URL("../js/pages/admin-page.js", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../js/admin/admin-dashboard.js", import.meta.url), "utf8");
  const crud = readFileSync(new URL("../js/admin/admin-crud.js", import.meta.url), "utf8");
  const version = "20260929-lesson-billing";
  assert.match(admin, new RegExp(`admin-page\\.js\\?v=${version}`));
  assert.match(page, new RegExp(`admin-dashboard\\.js\\?v=${version}`));
  assert.match(dashboard, new RegExp(`payments\\.js\\?v=${version}`));
  assert.match(dashboard, new RegExp(`student-profile\\.js\\?v=${version}`));
  assert.match(crud, new RegExp(`students-crud\\.js\\?v=${version}`));
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
  assert.match(rules, /function hasValidBillingAccount/);
  assert.match(paymentRule, /hasValidBillingAccount\(request\.resource\.data\)/);
});

test("payment UI reconciles completed lessons and allows one payment to cover several", () => {
  const source = readFileSync(new URL("../js/admin/payments.js", import.meta.url), "utf8");
  const calendar = readFileSync(new URL("../js/admin/calendar.js", import.meta.url), "utf8");
  const admin = readFileSync(new URL("../admin.html", import.meta.url), "utf8");
  assert.match(source, /calendarEventsRepository/);
  assert.match(source, /reconcileCompletedLessonCharges/);
  assert.match(source, /selectedAllocations/);
  assert.match(calendar, /createOccurrenceCharges/);
  assert.match(calendar, /calendar-payment-badge/);
  assert.match(admin, /data-payment-lessons/);
  assert.match(admin, /id="student-lesson-rate"/);
});

test("student and offline-group editors persist the correct fixed rate", () => {
  const studentsSource = readFileSync(new URL("../js/admin/students-crud.js", import.meta.url), "utf8");
  const groupsSource = readFileSync(new URL("../js/admin/groups-crud.js", import.meta.url), "utf8");
  assert.match(studentsSource, /billing:[\s\S]*?lessonRate/);
  assert.match(studentsSource, /billingOverride: \{\}/);
  assert.match(groupsSource, /lessonMode"\)\.value === "offline" && lessonRate === null/);
  assert.match(groupsSource, /fixed price for this offline group/);
});
