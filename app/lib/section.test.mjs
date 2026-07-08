// PRD-003 follow-up tests — deterministic deconfliction / benign-section tagging.
// The tool tags (never removes), so every assertion is about `section_hint` /
// `section_heading` presence, and the §2.0 slice-equality invariant is untouched.

import { test } from "node:test";
import assert from "node:assert/strict";
import { sectionHint } from "./section.mjs";
import { extractIocs } from "./iocExtract.mjs";

const findVal = (items, v) => items.find((i) => i.value === v);

test("sectionHint: indicator under a benign heading is tagged", () => {
  const text = "Deconfliction (known-good):\nsandbox 203.0.113.9 used in testing";
  const at = text.indexOf("203.0.113.9");
  const r = sectionHint(text, at);
  assert.equal(r?.section_hint, "benign");
  assert.equal(r?.section_heading, "Deconfliction (known-good):");
});

test("sectionHint: threat heading below a benign heading wins (no benign tag)", () => {
  const text =
    "Benign test infrastructure:\n\nIndicators of Compromise\nevilhost 198.51.100.7 c2";
  const at = text.indexOf("198.51.100.7");
  assert.equal(sectionHint(text, at), null);
});

test("sectionHint: no heading -> no tag", () => {
  const text = "the beacon reached 198.51.100.7 during the intrusion";
  assert.equal(sectionHint(text, text.indexOf("198.51.100.7")), null);
});

test("sectionHint: benign WORD buried in prose is not a heading", () => {
  const text =
    "This indicator is not obviously malicious but was excluded elsewhere in review.\n1.2.3.4";
  // The prose line has \". \" mid-line -> not heading-shaped -> ignored.
  assert.equal(sectionHint(text, text.indexOf("1.2.3.4")), null);
});

test("extractIocs: benign-section hash carries section_hint, IOC-list hash does not", () => {
  const md5 = "d41d8cd98f00b204e9800998ecf8427e";
  const sha1 = "da39a3ee5e6b4b0d3255bfef95601890afd80709";
  const text =
    `Known-good hashes (deconfliction):\n${md5}\n\n` +
    `Malicious file hashes\n${sha1}`;
  const items = extractIocs(text);
  const benign = findVal(items, md5);
  const bad = findVal(items, sha1);
  assert.equal(benign?.section_hint, "benign");
  assert.equal(benign?.section_heading, "Known-good hashes (deconfliction):");
  assert.equal(bad?.section_hint, undefined);
  // slice-equality invariant untouched by the tag
  for (const it of items) {
    assert.equal(text.slice(it.start, it.end), it.source_span);
  }
});

test("extractIocs: untagged items do not carry section fields", () => {
  const items = extractIocs("plain beacon to 8.8.8.8 seen");
  const ip = items.find((i) => i.value === "8.8.8.8");
  assert.equal("section_hint" in ip, false);
  assert.equal("section_heading" in ip, false);
});
