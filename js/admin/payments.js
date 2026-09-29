import { calendarEventsRepository } from "../data/repositories/calendar-events-repository.js";
import { groupsRepository } from "../data/repositories/groups-repository.js";
import { paymentTransactionsRepository } from "../data/repositories/payment-transactions-repository.js?v=20260929-legacy-credit";
import { studentsRepository } from "../data/repositories/students-repository.js";
import { completedCalendarOccurrences } from "../domain/calendar.js?v=20260929-lesson-billing";
import {
  PAYMENT_ACCOUNT_TYPES,
  PAYMENT_METHODS,
  PAYMENT_TRANSACTION_TYPES,
  accountLessonPaymentStates,
  accountTransactions,
  billingTargetsForCalendarOccurrence,
  buildGroupBillingUpdate,
  buildStudentBillingUpdate,
  calculateAccountBalance,
  effectiveGroupBilling,
  effectiveStudentBilling,
  filterPaymentRows,
  formatRubles,
  legacyCreditSettlementAmount,
  lessonChargeForTarget,
  paymentAccountKey,
  paymentsSummary,
  signedTransactionAmount,
  sortTransactionsNewestFirst,
  transactionMatchesAccount,
  validateTransaction,
} from "../domain/payments.js?v=20260929-legacy-credit";

const DATE_FORMAT = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });
const METHOD_LABELS = Object.freeze({ bank_transfer: "Bank transfer", cash: "Cash", other: "Other" });
const FORMAT_LABELS = Object.freeze({ individual: "Individual", pair: "Pair", group: "Group" });
const TYPE_LABELS = Object.freeze({ PAYMENT: "Payment", CHARGE: "Lesson charge", ADJUSTMENT: "Adjustment" });

let elements;
let initialized = false;
let students = [];
let groups = [];
let calendarEvents = [];
let transactions = [];
let rows = [];
let activeFilter = "all";
let activeMode = "online";
let selectedAccountKey = "";

function toDate(value) {
  if (value?.toDate) return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function todayInputValue() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function rowKey(row) {
  return paymentAccountKey(row.accountType, row.accountId);
}

function findRow(key) {
  return rows.find((row) => rowKey(row) === key) ?? null;
}

function rowTransactions(row) {
  return sortTransactionsNewestFirst(accountTransactions(transactions, row.accountType, row.accountId));
}

function lastPayment(row) {
  return rowTransactions(row).find(({ type }) => type === PAYMENT_TRANSACTION_TYPES.PAYMENT) ?? null;
}

function buildRows() {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const offlineGroupIds = new Set(groups.filter(({ lessonMode }) => lessonMode === "offline").map(({ id }) => id));
  const studentRows = students
    .filter((student) => !offlineGroupIds.has(student.groupId))
    .map((student) => {
      const group = groupsById.get(student.groupId) ?? null;
      const lessonMode = group?.lessonMode === "offline" || student.lessonMode === "offline" ? "offline" : "online";
      return {
        accountType: PAYMENT_ACCOUNT_TYPES.STUDENT,
        accountId: student.id,
        accountName: student.name || "Unnamed student",
        accountMeta: group?.name || "Individual",
        color: student.color || "#7da67b",
        lessonMode,
        student,
        group,
        billing: effectiveStudentBilling(student, group),
      };
    });
  const groupRows = groups.filter(({ lessonMode }) => lessonMode === "offline").map((group) => ({
    accountType: PAYMENT_ACCOUNT_TYPES.GROUP,
    accountId: group.id,
    accountName: group.name || "Unnamed group",
    accountMeta: "Offline group account",
    color: group.color || "#7da67b",
    lessonMode: "offline",
    student: null,
    group,
    billing: effectiveGroupBilling(group),
  }));
  rows = [...studentRows, ...groupRows].map((row) => ({
    ...row,
    balance: calculateAccountBalance(transactions, row.accountType, row.accountId),
    lastPayment: lastPayment(row),
  })).sort((first, second) => first.accountName.localeCompare(second.accountName));
}

function summaryText(key, value, detail) {
  elements.root.querySelector(`[data-payment-summary="${key}"]`).textContent = formatRubles(value);
  elements.root.querySelector(`[data-payment-summary-detail="${key}"]`).textContent = detail;
}

function renderSummary() {
  const scopedRows = rows.filter((row) => activeMode === "all" || row.lessonMode === activeMode);
  const scopedTransactions = transactions.filter((transaction) => scopedRows.some((row) =>
    transactionMatchesAccount(transaction, row.accountType, row.accountId)));
  const summary = paymentsSummary(scopedTransactions, scopedRows);
  summaryText("received", summary.received, `${summary.receivedCount} ${summary.receivedCount === 1 ? "payment" : "payments"}`);
  summaryText("expected", summary.expected, `${summary.chargeCount} completed ${summary.chargeCount === 1 ? "lesson" : "lessons"}`);
  summaryText("outstanding", summary.outstanding, `${summary.outstandingCount} ${summary.outstandingCount === 1 ? "account" : "accounts"}`);
  summaryText("credit", summary.credit, `${summary.creditCount} ${summary.creditCount === 1 ? "account" : "accounts"}`);
}

function createAccountCell(row) {
  const cell = document.createElement("span");
  cell.className = "payments-student-cell";
  const marker = document.createElement("i");
  marker.style.backgroundColor = row.color;
  const identity = document.createElement("span");
  const name = document.createElement("strong");
  const meta = document.createElement("small");
  name.textContent = row.accountName;
  meta.textContent = row.accountMeta;
  identity.append(name, meta);
  cell.append(marker, identity);
  return cell;
}

function createPaymentRow(row) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "payments-table__row";
  button.dataset.paymentAccount = rowKey(row);
  button.setAttribute("role", "row");
  button.append(createAccountCell(row));
  const format = document.createElement("span");
  format.dataset.label = "Format";
  const formatName = document.createElement("strong");
  const duration = document.createElement("small");
  formatName.textContent = FORMAT_LABELS[row.billing.lessonFormat];
  duration.textContent = `${row.billing.standardDuration} min`;
  format.append(formatName, duration);
  const rate = document.createElement("span");
  rate.dataset.label = "Lesson rate";
  rate.textContent = formatRubles(row.billing.lessonRate);
  const balance = document.createElement("span");
  balance.dataset.label = "Balance";
  balance.className = "payment-balance";
  balance.dataset.balance = row.balance > 0 ? "credit" : row.balance < 0 ? "outstanding" : "zero";
  balance.textContent = formatRubles(row.balance, { signed: true });
  const last = document.createElement("span");
  last.dataset.label = "Last payment";
  if (row.lastPayment) {
    const date = document.createElement("strong");
    const method = document.createElement("small");
    const paymentDate = toDate(row.lastPayment.date ?? row.lastPayment.createdAt);
    date.textContent = paymentDate ? DATE_FORMAT.format(paymentDate) : "Date unavailable";
    method.textContent = METHOD_LABELS[row.lastPayment.paymentMethod] || "Payment";
    last.append(date, method);
  } else last.textContent = "—";
  const arrow = document.createElement("span");
  arrow.className = "payments-table__arrow";
  arrow.textContent = "›";
  button.append(format, rate, balance, last, arrow);
  return button;
}

function renderRows() {
  const modeRows = filterPaymentRows(rows, "all", "", activeMode);
  const visible = filterPaymentRows(rows, activeFilter, elements.search.value, activeMode);
  elements.rows.replaceChildren(...visible.map(createPaymentRow));
  elements.empty.hidden = visible.length > 0;
  elements.count.textContent = `Showing ${visible.length} of ${modeRows.length} accounts`;
}

function renderPage() {
  buildRows();
  renderSummary();
  renderRows();
}

function createLedgerItem(transaction) {
  const item = document.createElement("li");
  item.dataset.transactionType = transaction.type.toLowerCase();
  const marker = document.createElement("span");
  marker.className = "payment-ledger__marker";
  const body = document.createElement("div");
  const heading = document.createElement("strong");
  const meta = document.createElement("small");
  const amount = document.createElement("b");
  const date = toDate(transaction.date ?? transaction.createdAt);
  const lessonCount = Array.isArray(transaction.allocations) ? transaction.allocations.length : 0;
  heading.textContent = date ? DATE_FORMAT.format(date) : "Date unavailable";
  meta.textContent = [TYPE_LABELS[transaction.type], lessonCount ? `${lessonCount} ${lessonCount === 1 ? "lesson" : "lessons"}` : "", transaction.lessonLabel, METHOD_LABELS[transaction.paymentMethod], transaction.note]
    .filter(Boolean).join(" · ");
  amount.textContent = formatRubles(signedTransactionAmount(transaction), { signed: true });
  body.append(heading, meta);
  item.append(marker, body, amount);
  return item;
}

function openDrawer(key) {
  const row = findRow(key);
  if (!row) return;
  selectedAccountKey = key;
  const content = document.createDocumentFragment();
  const header = document.createElement("header");
  const marker = document.createElement("span");
  marker.className = "payment-drawer__avatar";
  marker.style.backgroundColor = row.color;
  marker.textContent = row.accountName.charAt(0).toUpperCase();
  const identity = document.createElement("div");
  const title = document.createElement("h2");
  const subtitle = document.createElement("p");
  title.id = "payment-drawer-heading";
  title.textContent = row.accountName;
  subtitle.textContent = `${row.accountMeta} · ${FORMAT_LABELS[row.billing.lessonFormat]} · ${row.billing.standardDuration} min`;
  identity.append(title, subtitle);
  header.append(marker, identity);
  const balance = document.createElement("section");
  balance.className = "payment-drawer__balance";
  const balanceLabel = document.createElement("span");
  const balanceValue = document.createElement("strong");
  const balanceHelp = document.createElement("small");
  balanceLabel.textContent = "Account balance";
  balanceValue.textContent = formatRubles(row.balance, { signed: true });
  balanceValue.dataset.balance = row.balance > 0 ? "credit" : row.balance < 0 ? "outstanding" : "zero";
  const lessonStates = accountLessonPaymentStates(transactions, row.accountType, row.accountId);
  const unpaidCount = [...lessonStates.values()].filter(({ status }) => status !== "paid").length;
  balanceHelp.textContent = unpaidCount
    ? `${unpaidCount} completed ${unpaidCount === 1 ? "lesson is" : "lessons are"} not fully paid.`
    : row.balance > 0 ? "Credit will cover the next completed lessons." : "All completed lessons are covered.";
  balance.append(balanceLabel, balanceValue, balanceHelp);
  const rate = document.createElement("div");
  rate.className = "payment-drawer__rate";
  const rateLabel = document.createElement("span");
  const rateValue = document.createElement("strong");
  rateLabel.textContent = "Fixed lesson rate";
  rateValue.textContent = formatRubles(row.billing.lessonRate);
  rate.append(rateLabel, rateValue);
  const actions = document.createElement("div");
  actions.className = "payment-drawer__actions";
  const add = document.createElement("button");
  const edit = document.createElement("button");
  add.type = edit.type = "button";
  add.className = "button-primary";
  add.dataset.drawerAddPayment = key;
  add.textContent = "+ Add payment";
  edit.dataset.drawerEditBilling = key;
  edit.textContent = "Edit fixed rate";
  actions.append(add, edit);
  const history = document.createElement("section");
  history.className = "payment-ledger";
  const historyTitle = document.createElement("h3");
  historyTitle.textContent = "Account history";
  const list = document.createElement("ol");
  const ledger = rowTransactions(row);
  if (ledger.length) list.append(...ledger.map(createLedgerItem));
  else {
    const empty = document.createElement("p");
    empty.className = "payments-empty";
    empty.textContent = "No ledger entries yet.";
    history.append(historyTitle, empty);
  }
  if (ledger.length) history.append(historyTitle, list);
  content.append(header, balance, rate, actions, history);
  elements.drawerContent.replaceChildren(content);
  if (!elements.drawer.open) elements.drawer.showModal();
}

function populateAccountSelect(selectedKey = "") {
  elements.paymentAccount.replaceChildren();
  const prompt = document.createElement("option");
  prompt.value = "";
  prompt.textContent = "Select student or offline group";
  elements.paymentAccount.append(prompt);
  ["online", "offline"].forEach((mode) => {
    const matching = rows.filter((row) => row.lessonMode === mode);
    if (!matching.length) return;
    const section = document.createElement("optgroup");
    section.label = mode === "online" ? "Online students" : "Offline students and groups";
    matching.forEach((row) => {
      const option = document.createElement("option");
      option.value = rowKey(row);
      option.textContent = `${row.accountName} — ${row.accountMeta}`;
      section.append(option);
    });
    elements.paymentAccount.append(section);
  });
  elements.paymentAccount.value = selectedKey;
}

function outstandingLessons(row) {
  if (!row) return [];
  const states = accountLessonPaymentStates(transactions, row.accountType, row.accountId);
  return [...states.values()].filter(({ outstandingAmount }) => outstandingAmount > 0.005).sort((first, second) => {
    const firstDate = toDate(first.charge.date ?? first.charge.createdAt)?.getTime() ?? 0;
    const secondDate = toDate(second.charge.date ?? second.charge.createdAt)?.getTime() ?? 0;
    return firstDate - secondDate;
  });
}

function syncPaymentSelection() {
  const selected = [...elements.paymentLessons.querySelectorAll("input:checked")];
  const total = selected.reduce((sum, input) => sum + Number(input.dataset.outstanding || 0), 0);
  elements.paymentSelection.textContent = selected.length
    ? `${selected.length} ${selected.length === 1 ? "lesson" : "lessons"} selected · ${formatRubles(total)}`
    : "No lessons selected — the payment will remain as account credit.";
  if (selected.length) elements.paymentForm.elements.amount.value = String(total);
}

function renderPaymentLessons() {
  const row = findRow(elements.paymentAccount.value);
  const lessons = outstandingLessons(row);
  elements.paymentLessons.replaceChildren(...lessons.map(({ charge, outstandingAmount, status }) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    const body = document.createElement("span");
    const title = document.createElement("strong");
    const meta = document.createElement("small");
    const date = toDate(charge.date ?? charge.createdAt);
    checkbox.type = "checkbox";
    checkbox.value = charge.id;
    checkbox.dataset.outstanding = String(outstandingAmount);
    title.textContent = charge.lessonLabel || "Completed lesson";
    meta.textContent = `${date ? DATE_FORMAT.format(date) : "Date unavailable"} · ${status === "partial" ? "Remaining" : "Due"} ${formatRubles(outstandingAmount)}`;
    body.append(title, meta);
    label.append(checkbox, body);
    return label;
  }));
  elements.paymentLessonsEmpty.hidden = lessons.length > 0;
  syncPaymentSelection();
}

function openPaymentDialog(key = "") {
  elements.paymentForm.reset();
  populateAccountSelect(key);
  elements.paymentForm.elements.date.value = todayInputValue();
  elements.paymentMessage.textContent = "";
  renderPaymentLessons();
  elements.paymentDialog.showModal();
}

function selectedAllocations(amount) {
  let remaining = amount;
  return [...elements.paymentLessons.querySelectorAll("input:checked")].map((input) => {
    const allocation = Math.min(remaining, Number(input.dataset.outstanding || 0));
    remaining -= allocation;
    return { chargeId: input.value, amount: allocation };
  }).filter(({ amount: allocation }) => allocation > 0);
}

async function savePayment(event) {
  event.preventDefault();
  const form = elements.paymentForm;
  const row = findRow(elements.paymentAccount.value);
  const amount = Number(form.elements.amount.value);
  const input = {
    accountType: row?.accountType,
    accountId: row?.accountId,
    type: PAYMENT_TRANSACTION_TYPES.PAYMENT,
    amount: form.elements.amount.value,
    date: `${form.elements.date.value}T12:00:00`,
    paymentMethod: form.elements.method.value,
    note: form.elements.note.value,
    allocations: selectedAllocations(amount),
  };
  const error = validateTransaction(input);
  if (error || !PAYMENT_METHODS.includes(input.paymentMethod) && input.paymentMethod !== "") {
    elements.paymentMessage.textContent = error || "Select a valid payment method.";
    return;
  }
  elements.paymentSave.disabled = true;
  elements.paymentMessage.textContent = "Saving…";
  try {
    await paymentTransactionsRepository.createTransaction(input);
    transactions = await paymentTransactionsRepository.list();
    window.dispatchEvent(new CustomEvent("teacher:billing-changed"));
    renderPage();
    elements.paymentDialog.close();
    if (selectedAccountKey === rowKey(row) && elements.drawer.open) openDrawer(rowKey(row));
  } catch (saveError) {
    console.error("Unable to save payment.", saveError);
    elements.paymentMessage.textContent = "Unable to save payment. Please try again.";
  } finally {
    elements.paymentSave.disabled = false;
  }
}

function openBillingDialog(key) {
  const row = findRow(key);
  if (!row) return;
  selectedAccountKey = key;
  const form = elements.billingForm;
  form.reset();
  form.dataset.accountKey = key;
  form.elements.lessonFormat.value = row.billing.lessonFormat;
  form.elements.lessonFormat.disabled = row.accountType === PAYMENT_ACCOUNT_TYPES.GROUP;
  form.elements.standardDuration.value = String(row.billing.standardDuration);
  form.elements.lessonRate.value = row.billing.lessonRate ?? "";
  elements.billingStudentName.textContent = `${row.accountName} · ${row.accountMeta}`;
  elements.billingMessage.textContent = "";
  elements.billingDialog.showModal();
}

async function saveBilling(event) {
  event.preventDefault();
  const form = elements.billingForm;
  const key = form.dataset.accountKey;
  const row = findRow(key);
  if (!row) return;
  let patch;
  try {
    patch = row.accountType === PAYMENT_ACCOUNT_TYPES.GROUP
      ? buildGroupBillingUpdate({ currentBilling: row.group.billing, standardDuration: form.elements.standardDuration.value, lessonRate: form.elements.lessonRate.value })
      : buildStudentBillingUpdate({ currentBilling: row.student.billing, lessonFormat: form.elements.lessonFormat.value, standardDuration: form.elements.standardDuration.value, lessonRate: form.elements.lessonRate.value });
  } catch (validationError) {
    elements.billingMessage.textContent = validationError.message;
    return;
  }
  elements.billingSave.disabled = true;
  elements.billingMessage.textContent = "Saving…";
  try {
    if (row.accountType === PAYMENT_ACCOUNT_TYPES.GROUP) {
      await groupsRepository.update(row.accountId, patch);
      Object.assign(row.group, patch);
    } else {
      await studentsRepository.update(row.accountId, patch);
      Object.assign(row.student, patch);
    }
    await reconcileCompletedLessonCharges();
    window.dispatchEvent(new CustomEvent("teacher:billing-changed"));
    renderPage();
    elements.billingDialog.close();
    if (elements.drawer.open) openDrawer(key);
  } catch (saveError) {
    console.error("Unable to save billing.", saveError);
    elements.billingMessage.textContent = "Unable to save billing. Please try again.";
  } finally {
    elements.billingSave.disabled = false;
  }
}

async function reconcileCompletedLessonCharges() {
  const pending = [];
  completedCalendarOccurrences(calendarEvents).forEach((occurrence) => {
    billingTargetsForCalendarOccurrence(occurrence, students, groups).forEach((target) => {
      if (!(target.lessonRate > 0) || lessonChargeForTarget(transactions, occurrence, target)) return;
      pending.push(paymentTransactionsRepository.createLessonCharge({
        accountType: target.accountType,
        accountId: target.accountId,
        amount: target.lessonRate,
        date: occurrence.startAt,
        lessonEventId: occurrence.id,
        lessonOccurrenceKey: occurrence.occurrenceKey,
        lessonId: occurrence.lessonId,
        courseId: occurrence.courseId,
        unitId: occurrence.unitId,
        groupId: occurrence.groupId,
        lessonLabel: occurrence.displayName || occurrence.manualTitle || "Completed lesson",
        attendanceBillingReason: "completed",
      }));
    });
  });
  if (!pending.length) return false;
  await Promise.all(pending);
  transactions = await paymentTransactionsRepository.list();
  return true;
}

async function settleLegacyCreditBalances() {
  buildRows();
  const pending = rows.map((row) => ({
    row,
    amount: legacyCreditSettlementAmount(transactions, row.accountType, row.accountId),
  })).filter(({ amount }) => amount > 0.005).map(({ row, amount }) =>
    paymentTransactionsRepository.createLegacyCreditSettlement({
      accountType: row.accountType,
      accountId: row.accountId,
      amount,
      date: "2026-09-28T23:59:00",
    }));
  if (!pending.length) return false;
  await Promise.all(pending);
  transactions = await paymentTransactionsRepository.list();
  return true;
}

export async function showPayments() {
  elements.state.hidden = false;
  elements.state.textContent = "Loading payments…";
  elements.content.hidden = true;
  try {
    [students, groups, calendarEvents, transactions] = await Promise.all([
      studentsRepository.list(), groupsRepository.list(), calendarEventsRepository.list(), paymentTransactionsRepository.list(),
    ]);
    const chargesCreated = await reconcileCompletedLessonCharges();
    const legacyCreditsSettled = await settleLegacyCreditBalances();
    if (chargesCreated || legacyCreditsSettled) window.dispatchEvent(new CustomEvent("teacher:billing-changed"));
    renderPage();
    elements.state.hidden = true;
    elements.content.hidden = false;
  } catch (error) {
    console.error("Unable to load payments.", error);
    elements.state.textContent = "Unable to load payments. Please try again.";
  }
}

export function initializePayments() {
  if (initialized) return;
  const root = document.querySelector('[data-admin-section="payments"]');
  const drawer = document.querySelector("[data-payment-drawer]");
  const paymentDialog = document.querySelector("[data-payment-dialog]");
  const billingDialog = document.querySelector("[data-billing-dialog]");
  if (!root || !drawer || !paymentDialog || !billingDialog) return;
  elements = {
    root, state: root.querySelector("[data-payments-state]"), content: root.querySelector("[data-payments-content]"),
    rows: root.querySelector("[data-payment-rows]"), empty: root.querySelector("[data-payments-empty]"),
    count: root.querySelector("[data-payments-count]"), search: root.querySelector("[data-payment-search]"),
    drawer, drawerContent: drawer.querySelector("[data-payment-drawer-content]"), paymentDialog,
    paymentForm: paymentDialog.querySelector("[data-payment-form]"), paymentAccount: paymentDialog.querySelector("[data-payment-account]"),
    paymentLessons: paymentDialog.querySelector("[data-payment-lessons]"), paymentLessonsEmpty: paymentDialog.querySelector("[data-payment-lessons-empty]"),
    paymentSelection: paymentDialog.querySelector("[data-payment-selection]"), paymentMessage: paymentDialog.querySelector("[data-payment-form-message]"),
    paymentSave: paymentDialog.querySelector("[data-payment-save]"), billingDialog, billingForm: billingDialog.querySelector("[data-billing-form]"),
    billingStudentName: billingDialog.querySelector("[data-billing-student-name]"), billingMessage: billingDialog.querySelector("[data-billing-form-message]"),
    billingSave: billingDialog.querySelector("[data-billing-save]"),
  };
  if (Object.values(elements).some((element) => !element)) return;
  root.querySelector("[data-payment-add]").addEventListener("click", () => openPaymentDialog());
  root.querySelectorAll("[data-payment-filter]").forEach((button) => button.addEventListener("click", () => {
    activeFilter = button.dataset.paymentFilter;
    root.querySelectorAll("[data-payment-filter]").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    renderRows();
  }));
  root.querySelectorAll("[data-payment-mode]").forEach((button) => button.addEventListener("click", () => {
    activeMode = button.dataset.paymentMode;
    root.querySelectorAll("[data-payment-mode]").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    renderSummary();
    renderRows();
  }));
  elements.search.addEventListener("input", renderRows);
  elements.rows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-payment-account]");
    if (button) openDrawer(button.dataset.paymentAccount);
  });
  drawer.querySelector("[data-payment-drawer-close]").addEventListener("click", () => drawer.close());
  drawer.addEventListener("click", (event) => {
    const add = event.target.closest("[data-drawer-add-payment]");
    const edit = event.target.closest("[data-drawer-edit-billing]");
    if (add) openPaymentDialog(add.dataset.drawerAddPayment);
    if (edit) openBillingDialog(edit.dataset.drawerEditBilling);
  });
  elements.paymentAccount.addEventListener("change", renderPaymentLessons);
  elements.paymentLessons.addEventListener("change", syncPaymentSelection);
  elements.paymentForm.addEventListener("submit", savePayment);
  paymentDialog.querySelectorAll("[data-payment-dialog-close], [data-payment-dialog-cancel]").forEach((button) => button.addEventListener("click", () => paymentDialog.close()));
  elements.billingForm.addEventListener("submit", saveBilling);
  billingDialog.querySelectorAll("[data-billing-dialog-close], [data-billing-dialog-cancel]").forEach((button) => button.addEventListener("click", () => billingDialog.close()));
  initialized = true;
}
