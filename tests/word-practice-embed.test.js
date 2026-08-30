import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PRODUCTION_APP = "https://bot-1788103967-7444-sasha25.bothost.tech";

async function studentPortalSource() {
  return readFile(new URL("../student.html", import.meta.url), "utf8");
}

test("Student Portal keeps the AI Practice hash route and navigation item", async () => {
  const html = await studentPortalSource();
  assert.match(html, /href="#ai-practice"\s+data-student-link="ai-practice"/);
  assert.match(html, /id="ai-practice"\s+data-student-section="ai-practice"/);
});

test("AI Practice embeds the standalone production application", async () => {
  const html = await studentPortalSource();
  assert.match(html, new RegExp(`<iframe[\\s\\S]+src="${PRODUCTION_APP.replaceAll(".", "\\.")}"`));
  assert.match(html, /title="Word Practice AI"/);
});

test("AI Practice provides a safe new-tab fallback link", async () => {
  const html = await studentPortalSource();
  assert.match(html, new RegExp(`href="${PRODUCTION_APP.replaceAll(".", "\\.")}"[\\s\\S]+target="_blank"[\\s\\S]+rel="noopener noreferrer"`));
  assert.match(html, /Open AI Practice/);
});

test("Teacher Dashboard no longer contains the cross-origin practice form", async () => {
  const html = await studentPortalSource();
  const view = await readFile(new URL("../js/student/student-view.js", import.meta.url), "utf8");
  assert.doesNotMatch(html, /data-ai-practice-form|data-ai-practice-submit/);
  assert.doesNotMatch(view, /initializeAIPractice|createPractice/);
});
