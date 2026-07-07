// PRD-003 Feature 2 tests — curated entity matching, FP guard (Codex F8),
// evidence retention (Codex F10), and §2.0 provenance.

import { test } from "node:test";
import assert from "node:assert/strict";
import { detectEntities } from "./entities.mjs";

const GAZ = {
  actors: [
    { name: "APT29", aliases: ["Cozy Bear", "Nobelium"] },
    { name: "Scattered Spider", aliases: ["Octo Tempest"] },
    { name: "Turla", aliases: ["Snake"] },
  ],
  tools: [{ name: "Cobalt Strike", aliases: ["CS"] }],
  malware: [{ name: "Emotet", aliases: ["Geodo"] }],
};
const STOP = ["cat", "cs", "menu"]; // "cs" (len 2) also < MIN, but list it too

function slices(text, entity) {
  for (const s of entity.spans) {
    assert.equal(text.slice(s.start, s.end), s.source_span);
    assert.ok(s.source_span.trim().length > 0);
  }
}

test("matches canonical name and resolves alias to canonical", () => {
  const text = "Intrusion by APT29. Also tracked as Cozy Bear in prior reports.";
  const out = detectEntities(text, GAZ, STOP);
  const apt = out.find((e) => e.name === "APT29");
  assert.ok(apt);
  assert.equal(apt.kind, "actor");
  assert.equal(apt.count, 2); // "APT29" + "Cozy Bear"
  slices(text, apt);
});

test("multi-word tool and malware match", () => {
  const out = detectEntities("Operators deployed Cobalt Strike and Emotet.", GAZ, STOP);
  assert.ok(out.find((e) => e.name === "Cobalt Strike" && e.kind === "tool"));
  assert.ok(out.find((e) => e.name === "Emotet" && e.kind === "malware"));
});

test("FP guard: stoplisted alias 'CS' does NOT match (Codex F8)", () => {
  const out = detectEntities("The CS team met about menu items.", GAZ, STOP);
  assert.deepEqual(out, []);
});

test("FP guard: term shorter than 4 chars never matches", () => {
  // "Snake" is 5 chars so it matches; a 3-char alias would not. Verify no match
  // from an injected short alias.
  const gaz = { actors: [{ name: "XYZ", aliases: [] }], tools: [], malware: [] };
  assert.deepEqual(detectEntities("XYZ appeared", gaz, []), []);
});

test("no substring match inside a larger token", () => {
  // "Turla" must not match inside "Turlaish" / "reTurla".
  const out = detectEntities("The word Turlaish and reTurla are not actors.", GAZ, STOP);
  assert.deepEqual(out, []);
});

test("word-boundary match with punctuation around the name", () => {
  const out = detectEntities("(Turla) and 'Snake' operated.", GAZ, STOP);
  const t = out.find((e) => e.name === "Turla");
  assert.ok(t);
  assert.equal(t.count, 2);
});

test("evidence retained: up to 5 spans per entity (Codex F10)", () => {
  const text = ("APT29 ").repeat(8);
  const out = detectEntities(text, GAZ, STOP);
  const apt = out.find((e) => e.name === "APT29");
  assert.equal(apt.count, 8);
  assert.equal(apt.spans.length, 5); // capped
});

test("stable sort by kind then name", () => {
  const text = "Emotet Cobalt Strike APT29 Turla";
  const out = detectEntities(text, GAZ, STOP);
  const keys = out.map((e) => `${e.kind} ${e.name}`);
  assert.deepEqual(keys, [...keys].sort());
});

test("case-insensitive match, surface form preserved in span", () => {
  const text = "apt29 and NOBELIUM active";
  const out = detectEntities(text, GAZ, STOP);
  const apt = out.find((e) => e.name === "APT29");
  assert.equal(apt.count, 2);
  assert.ok(apt.spans.some((s) => s.source_span === "apt29"));
  assert.ok(apt.spans.some((s) => s.source_span === "NOBELIUM"));
});

test("empty inputs do not throw", () => {
  assert.deepEqual(detectEntities("", GAZ, STOP), []);
  assert.deepEqual(detectEntities("text", { actors: [], tools: [], malware: [] }, []), []);
});
