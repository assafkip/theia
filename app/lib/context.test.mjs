import { test } from "node:test";
import assert from "node:assert/strict";
import { sentenceContext } from "./context.mjs";

test("widens a matched indicator to its surrounding sentence, verbatim", () => {
  const text =
    "Initial access was gained via phishing. Black Basta affiliates have used 170.130.165[.]73 for command and control. Other infrastructure was rotated.";
  const ind = "170.130.165[.]73";
  const start = text.indexOf(ind);
  const { context, context_start, context_end } = sentenceContext(text, start, start + ind.length);

  assert.equal(text.slice(context_start, context_end), context, "slice-equality invariant");
  assert.ok(context.includes(ind), "context contains the indicator");
  assert.ok(context.length > ind.length, "context is more than the bare indicator");
  assert.equal(context, "Black Basta affiliates have used 170.130.165[.]73 for command and control.");
});

test("a bare IOC-list row does not fabricate a sentence (negative self-test)", () => {
  const text = "Indicators of compromise:\nevilphishing[.]com\nlogin[.]com\n";
  const ind = "evilphishing[.]com";
  const start = text.indexOf(ind);
  const { context, context_start, context_end } = sentenceContext(text, start, start + ind.length);

  assert.equal(text.slice(context_start, context_end), context, "slice-equality invariant");
  assert.equal(context, ind, "collapses to the indicator; no invented context");
});

test("respects the length cap and keeps the indicator inside", () => {
  const filler = "word ".repeat(200); // no sentence terminators
  const text = filler + "8.8.8.8" + (" more").repeat(200);
  const start = text.indexOf("8.8.8.8");
  const { context, context_start, context_end } = sentenceContext(text, start, start + 7, { cap: 120 });

  assert.equal(text.slice(context_start, context_end), context, "slice-equality invariant");
  assert.ok(context.includes("8.8.8.8"), "indicator survives the cap");
  assert.ok(context.length <= 120, "cap enforced");
});

test("stops at newline boundaries (table rows stay one row)", () => {
  const text = "45.11.181[.]44\tC2 server\tBlack Basta\n66.42.118[.]54\tC2 server\n";
  const ind = "45.11.181[.]44";
  const start = text.indexOf(ind);
  const { context, context_start, context_end } = sentenceContext(text, start, start + ind.length);

  assert.equal(text.slice(context_start, context_end), context, "slice-equality invariant");
  assert.equal(context, "45.11.181[.]44\tC2 server\tBlack Basta");
});
