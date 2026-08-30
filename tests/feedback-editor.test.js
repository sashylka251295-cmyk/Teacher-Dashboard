import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("every profile feedback record has its own edit action", async () => {
  const source = await readFile(new URL("../js/admin/student-profile.js", import.meta.url), "utf8");
  assert.match(source, /edit\.dataset\.editFeedback = feedback\.id/);
  assert.doesNotMatch(source, /if \(feedback\.progressHistoryId\) \{[\s\S]*?Edit feedback/);
});

test("feedback editor publishes an updated student-visible version", async () => {
  const html = await readFile(new URL("../admin.html", import.meta.url), "utf8");
  const source = await readFile(new URL("../js/admin/student-profile.js", import.meta.url), "utf8");
  assert.match(html, /data-feedback-record-editor-dialog/);
  assert.match(html, /data-feedback-record-editor-save>Update feedback/);
  assert.match(source, /feedbackDraftsRepository\.saveDraft\(feedback\.id, content\)/);
  assert.match(source, /feedbackDraftsRepository\.publish\(feedback\.id, content\)/);
});

test("feedback deletion removes the draft and its student-visible versions", async () => {
  const html = await readFile(new URL("../admin.html", import.meta.url), "utf8");
  const profile = await readFile(new URL("../js/admin/student-profile.js", import.meta.url), "utf8");
  const repository = await readFile(new URL("../js/data/repositories/feedback-drafts-repository.js", import.meta.url), "utf8");
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  assert.match(html, /data-feedback-record-editor-delete>Delete feedback/);
  assert.match(profile, /removeWithPublishedVersions\(feedback\.id\)/);
  assert.match(repository, /where\("feedbackId", "==", id\)/);
  assert.match(repository, /versionsSnapshot\.docs\.forEach\(\(version\) => batch\.delete\(version\.ref\)\)/);
  assert.match(repository, /batch\.delete\(doc\(firestore, COLLECTIONS\.FEEDBACK_DRAFTS, id\)\)/);
  assert.match(rules, /match \/feedbackVersions\/\{versionId\}[\s\S]*?allow create, delete: if isAdmin\(\);/);
});
