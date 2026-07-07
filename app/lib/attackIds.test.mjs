// PRD-003 Feature 3 tests — printed ATT&CK ids, snapshot gating (Codex F11),
// and §2.0 provenance.

import { test } from "node:test";
import assert from "node:assert/strict";
import { extractAttackIds } from "./attackIds.mjs";

const MAP = { T1566: "Phishing", T1078: "Valid Accounts", "T1078.004": "Cloud Accounts" };

test("captures printed technique and sub-technique with names", () => {
  const text = "Initial access via T1566; then T1078.004 for persistence.";
  const out = extractAttackIds(text, MAP);
  assert.deepEqual(out.map((o) => o.id), ["T1078.004", "T1566"]);
  assert.equal(out.find((o) => o.id === "T1566").name, "Phishing");
  assert.equal(out.find((o) => o.id === "T1078.004").name, "Cloud Accounts");
  for (const o of out) {
    assert.equal(text.slice(o.start, o.end), o.source_span);
    assert.equal(o.in_attack, true);
  }
});

test("id NOT in snapshot is flagged in_attack:false (Codex F11)", () => {
  const out = extractAttackIds("row id T9999 in a table", MAP);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "T9999");
  assert.equal(out[0].in_attack, false);
  assert.equal(out[0].name, null);
});

test("sub-technique of a known parent inherits parent name", () => {
  const out = extractAttackIds("saw T1566.002 in logs", MAP);
  assert.equal(out[0].id, "T1566.002");
  assert.equal(out[0].in_attack, true);
  assert.equal(out[0].name, "Phishing"); // parent fallback
});

test("prose with no printed id yields none", () => {
  assert.deepEqual(extractAttackIds("phishing led to valid account abuse", MAP), []);
});

test("dedupe by id, count occurrences, stable sort", () => {
  const out = extractAttackIds("T1566 and again T1566 plus T1078", MAP);
  assert.deepEqual(out.map((o) => o.id), ["T1078", "T1566"]);
  assert.equal(out.find((o) => o.id === "T1566").count, 2);
});

test("empty inputs do not throw", () => {
  assert.deepEqual(extractAttackIds("", MAP), []);
  assert.deepEqual(extractAttackIds("T1566", {}), [
    { id: "T1566", name: null, in_attack: false, source_span: "T1566", start: 0, end: 5, count: 1 },
  ]);
});
