import { groupsRepository } from "../data/repositories/groups-repository.js";
import { paymentTransactionsRepository } from "../data/repositories/payment-transactions-repository.js?v=20260906-payments";
import { studentsRepository } from "../data/repositories/students-repository.js";
import {
  PAYMENT_METHODS,
  PAYMENT_TRANSACTION_TYPES,
  calculateStudentBalance,
  buildStudentBillingUpdate,
  effectiveStudentBilling,
  filterPaymentRows,
  formatRubles,
  paymentsSummary,
  signedTransactionAmount,
  sortTransactionsNewestFirst,
  validateTransaction,
} from "../domain/payments.js?v=20260907-billing-filters";

const DATE_FORMAT = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });
const METHOD_LABELS = Object.freeze({ bank_transfer: "Bank transfer", cash: "Cash", other: "Other" });
const FORMAT_LABELS = Object.freeze({ individual: "Individual", pair: "Pair", group: "Group" });
const TYPE_LABELS = Object.freeze({ PAYMENT: "Payment", CHARGE: "Lesson charge", ADJUSTMENT: "Adjustment" });

let elements;
let initialized = false;
let students = [];
let groups = [];
let transactions = [];
let rows = [];
let activeFilter = "all";
let activeMode = "online";
let selectedStudentId = "";

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

function studentTransactions(studentId) {
  return sortTransactionsNewestFirst(transactions.filter((transaction) => transaction.studentId === studentId));
}

function lastPayment(studentId) {
  return studentTransactions(studentId).find(({ type }) => type === PAYMENT_TRANSACTION_TYPES.PAYMENT) ?? null;
}

function buildRows() {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  rows = students.map((student) => {
    const group = groupsById.get(student.groupId) ?? null;
    return {
      student,
      group,
      billing: effectiveStudentBilling(student, group),
      balance: calculateStudentBalance(transactions, student.id),
      lastPayment: lastPayment(student.id),
    };
  }).sort((first, second) => String(first.student.name).localeCompare(String(second.student.name)));
}

function summaryText(key, value, detail) {
  elements.root.querySelector(`[data-payment-summary="${key}"]`).textContent = formatRubles(value);
  elements.root.querySelector(`[data-payment-summary-detail="${key}"]`).textContent = detail;
}

function renderSummary() {
  const scopedStudents = students.filter((student) => {
    const mode = student.lessonMode === "offline" ? "offline" : "online";
    return activeMode === "all" || mode === activeMode;
  });
  const scopedStudentIds = new Set(scopedStudents.map(({ id }) => id));
  const scopedTransactions = transactions.filter(({ studentId }) => scopedStudentIds.has(studentId));
  const summary = paymentsSummary(scopedTransactions, scopedStudents);
  summaryText("received", summary.received, `${summary.receivedCount} ${summary.receivedCount === 1 ? "payment" : "payments"}`);
  summaryText("expected", summary.expected, `${summary.chargeCount} recorded ${summary.chargeCount === 1 ? "charge" : "charges"}`);
  summaryText("outstanding", summary.outstanding, `${summary.outstandingCount} ${summary.outstandingCount === 1 ? "student" : "students"}`);
  summaryText("credit", summary.credit, `${summary.creditCount} ${summary.creditCount === 1 ? "student" : "students"}`);
}

function createStudentCell(row) {
  const cell = document.createElement("span");
  cell.className = "payments-student-cell";
  const marker = document.createElement("i");
  marker.style.backgroundColor = row.student.color || "#7da67b";
  const identity = document.createElement("span");
  const name = document.createElement("strong");
  const meta = document.createElement("small");
  name.textContent = row.student.name || "Unnamed student";
  meta.textContent = row.group?.name || "Individual";
  identity.append(name, meta);
  cell.append(marker, identity);
  return cell;
}

function createPaymentRow(row) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "payments-table__row";
  button.dataset.paymentStudent = row.student.id;
  button.setAttribute("role", "row");
  button.append(createStudentCell(row));

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
  elements.count.textContent = `Showing ${visible.length} of ${modeRows.length} students`;
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
  heading.textContent = date ? DATE_FORMAT.format(date) : "Date unavailable";
  meta.textContent = [TYPE_LABELS[transaction.type], METHOD_LABELS[transaction.paymentMethod], transaction.note]
    .filter(Boolean).join(" · ");
  amount.textContent = formatRubles(signedTransactionAmount(transaction), { signed: true });
  body.append(heading, meta);
  item.append(marker, body, amount);
  return item;
}

function openDrawer(studentId) {
  const row = rows.find(({ student }) => student.id === studentId);
  if (!row) return;
  selectedStudentId = studentId;
  const content = document.createDocumentFragment();
  const header = document.createElement("header");
  const marker = document.createElement("span");
  marker.className = "payment-drawer__avatar";
  marker.style.backgroundColor = row.student.color || "#7da67b";
  marker.textContent = String(row.student.name || "S").charAt(0).toUpperCase();
  const identity = document.createElement("div");
  const title = document.createElement("h2");
  const subtitle = document.createElement("p");
  title.id = "payment-drawer-heading";
  title.textContent = row.student.name || "Student";
  subtitle.textContent = `${FORMAT_LABELS[row.billing.lessonFormat]} · ${row.billing.standardDuration} min`;
  identity.append(title, subtitle);
  header.append(marker, identity);

  const balance = document.createElement("section");
  balance.className = "payment-drawer__balance";
  const balanceLabel = document.createElement("span");
  const balanceValue = document.createElement("strong");
  const balanceHelp = document.createElement("small");
  balanceLabel.textContent = "Balance";
  balanceValue.textContent = formatRubles(row.balance, { signed: true });
  balanceValue.dataset.balance = row.balance > 0 ? "credit" : row.balance < 0 ? "outstanding" : "zero";
  balanceHelp.textContent = "Calculated from payments, lesson charges and adjustments.";
  balance.append(balanceLabel, balanceValue, balanceHelp);

  const rate = document.createElement("div");
  rate.className = "payment-drawer__rate";
  const rateLabel = document.createElement("span");
  const rateValue = document.createElement("strong");
  rateLabel.textContent = "Lesson rate";
  rateValue.textContent = formatRubles(row.billing.lessonRate);
  rate.append(rateLabel, rateValue);

  const actions = document.createElement("div");
  actions.className = "payment-drawer__actions";
  const add = document.createElement("button");
  const edit = document.createElement("button");
  add.type = edit.type = "button";
  add.className = "button-primary";
  add.dataset.drawerAddPayment = studentId;
  add.textContent = "+ Add payment";
  edit.dataset.drawerEditBilling = studentId;
  edit.textContent = "Edit billing";
  actions.append(add, edit);

  const history = document.createElement("section");
  history.className = "payment-ledger";
  const historyTitle = document.createElement("h3");
  historyTitle.textContent = "Payment history";
  const list = document.createElement("ol");
  const ledger = studentTransactions(studentId);
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

function populateStudentSelect(selectedId = "") {
  elements.paymentStudent.replaceChildren();
  const prompt = document.createElement("option");
  prompt.value = "";
  prompt.textContent = "Select student";
  elements.paymentStudent.append(prompt);
  [...students].sort((a, b) => String(a.name).localeCompare(String(b.name))).forEach((student) => {
    const option = document.createElement("option");
    option.value = student.id;
    option.textContent = student.name;
    elements.paymentStudent.append(option);
  });
  elements.paymentStudent.value = selectedId;
}

function openPaymentDialog(studentId = "") {
  elements.paymentForm.reset();
  populateStudentSelect(studentId);
  elements.paymentForm.elements.date.value = todayInputValue();
  elements.paymentMessage.textContent = "";
  elements.paymentDialog.showModal();
}

async function savePayment(event) {
  event.preventDefault();
  const form = elements.paymentForm;
  const input = {
    studentId: form.elements.studentId.value,
    type: PAYMENT_TRANSACTION_TYPES.PAYMENT,
    amount: form.elements.amount.value,
    date: `${form.elements.date.value}T12:00:00`,
    paymentMethod: form.elements.method.value,
    note: form.elements.note.value,
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
    renderPage();
    elements.paymentDialog.close();
    if (selectedStudentId === input.studentId && elements.drawer.open) openDrawer(input.studentId);
  } catch (saveError) {
    console.error("Unable to save payment.", saveError);
    elements.paymentMessage.textContent = "Unable to save payment. Please try again.";
  } finally {
    elements.paymentSave.disabled = false;
  }
}

function openBillingDialog(studentId) {
  const row = rows.find(({ student }) => student.id === studentId);
  if (!row) return;
  selectedStudentId = studentId;
  const form = elements.billingForm;
  form.reset();
  form.dataset.studentId = studentId;
  form.elements.lessonFormat.value = row.billing.lessonFormat;
  form.elements.standardDuration.value = String(row.billing.standardDuration);
  elements.billingStudentName.textContent = row.student.name;
  const hasGroup = Boolean(row.group);
  elements.billingRateChoice.hidden = !hasGroup;
  elements.billingGroupRate.textContent = row.group
    ? `(${formatRubles(row.group.billing?.lessonRate)})` : "";
  const usesGroup = row.billing.rateSource === "group";
  if (hasGroup) form.elements.rateChoice.value = usesGroup ? "group" : "custom";
  form.elements.lessonRate.value = usesGroup || row.billing.lessonRate === null ? "" : row.billing.lessonRate;
  elements.billingRateField.hidden = hasGroup && usesGroup;
  elements.billingMessage.textContent = "";
  elements.billingDialog.showModal();
}

async function saveBilling(event) {
  event.preventDefault();
  const form = elements.billingForm;
  const student = students.find(({ id }) => id === form.dataset.studentId);
  if (!student) return;
  const format = form.elements.lessonFormat.value;
  const duration = Number(form.elements.standardDuration.value);
  const group = groups.find(({ id }) => id === student.groupId);
  const useGroupRate = Boolean(group) && form.elements.rateChoice.value === "group";
  const rateValue = form.elements.lessonRate.value;
  let patch;
  try {
    patch = buildStudentBillingUpdate({
      currentBilling: student.billing,
      hasGroup: Boolean(group),
      useGroupRate,
      lessonFormat: format,
      standardDuration: duration,
      lessonRate: rateValue,
    });
  } catch (validationError) {
    elements.billingMessage.textContent = validationError.message;
    return;
  }
  elements.billingSave.disabled = true;
  elements.billingMessage.textContent = "Saving…";
  try {
    await studentsRepository.update(student.id, patch);
    Object.assign(student, patch);
    renderPage();
    elements.billingDialog.close();
    if (elements.drawer.open) openDrawer(student.id);
  } catch (saveError) {
    console.error("Unable to save billing.", saveError);
    elements.billingMessage.textContent = "Unable to save billing. Please try again.";
  } finally {
    elements.billingSave.disabled = false;
  }
}

export async function showPayments() {
  elements.state.hidden = false;
  elements.state.textContent = "Loading payments…";
  elements.content.hidden = true;
  try {
    [students, groups, transactions] = await Promise.all([
      studentsRepository.list(), groupsRepository.list(), paymentTransactionsRepository.list(),
    ]);
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
    paymentForm: paymentDialog.querySelector("[data-payment-form]"), paymentStudent: paymentDialog.querySelector("[data-payment-student]"),
    paymentMessage: paymentDialog.querySelector("[data-payment-form-message]"), paymentSave: paymentDialog.querySelector("[data-payment-save]"),
    billingDialog, billingForm: billingDialog.querySelector("[data-billing-form]"),
    billingStudentName: billingDialog.querySelector("[data-billing-student-name]"),
    billingRateChoice: billingDialog.querySelector("[data-billing-rate-choice]"),
    billingGroupRate: billingDialog.querySelector("[data-billing-group-rate]"),
    billingRateField: billingDialog.querySelector("[data-billing-rate-field]"),
    billingMessage: billingDialog.querySelector("[data-billing-form-message]"), billingSave: billingDialog.querySelector("[data-billing-save]"),
  };
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
    const button = event.target.closest("[data-payment-student]");
    if (button) openDrawer(button.dataset.paymentStudent);
  });
  drawer.querySelector("[data-payment-drawer-close]").addEventListener("click", () => drawer.close());
  drawer.addEventListener("click", (event) => {
    const add = event.target.closest("[data-drawer-add-payment]");
    const edit = event.target.closest("[data-drawer-edit-billing]");
    if (add) openPaymentDialog(add.dataset.drawerAddPayment);
    if (edit) openBillingDialog(edit.dataset.drawerEditBilling);
  });
  elements.paymentForm.addEventListener("submit", savePayment);
  paymentDialog.querySelectorAll("[data-payment-dialog-close], [data-payment-dialog-cancel]").forEach((button) => button.addEventListener("click", () => paymentDialog.close()));
  elements.billingForm.addEventListener("submit", saveBilling);
  elements.billingForm.addEventListener("change", (event) => {
    if (event.target.name === "rateChoice") elements.billingRateField.hidden = event.target.value === "group";
  });
  billingDialog.querySelectorAll("[data-billing-dialog-close], [data-billing-dialog-cancel]").forEach((button) => button.addEventListener("click", () => billingDialog.close()));
  initialized = true;
}
