// Proof that the grounding port matches v007's contract. Runs with `node --test`
// — no API key, no network. This is the ship gate for the deterministic core:
// if the model claims a fact whose span is not verbatim in the doc, it must be
// dropped, exactly as v007 does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, spanGrounded, groundExtraction } from "./grounding.mjs";

test("exact substring is grounded", () => {
  const pdf = normalize("The actor used devicelogin.microsoft.com to phish.");
  assert.equal(spanGrounded("devicelogin.microsoft.com", pdf), true);
});

test("case-sensitive: wrong case is NOT grounded", () => {
  const pdf = normalize("Payload dropped as Invoice.pdf");
  assert.equal(spanGrounded("invoice.pdf", pdf), false);
});

test("whitespace runs collapse (newlines/tabs/multi-space)", () => {
  const pdf = normalize("credential   harvesting\tthen\nexfiltration");
  assert.equal(spanGrounded("credential harvesting then exfiltration", pdf), true);
});

test("U+200B zero-width space is treated as whitespace", () => {
  const pdf = normalize("api.tele​gram.org");
  assert.equal(spanGrounded("api.tele gram.org", pdf), true);
});

test("PDF hyphenated line-wrap collapses (command- and-control)", () => {
  // "- " after alphanumeric, next token continues a compound -> dehyphenate.
  const pdf = normalize("uses command- and-control over HTTPS");
  assert.equal(spanGrounded("uses command-and-control over HTTPS", pdf), true);
});

test("suspended-compound function word is protected (pre- and post-)", () => {
  // "and" is standalone (followed by space) -> the space is preserved.
  const pdf = normalize("pre- and post-exploitation");
  assert.equal(spanGrounded("pre- and post-exploitation", pdf), true);
});

test("typographic punctuation folds to ASCII", () => {
  const pdf = normalize("the actor’s “device code” flow — abused");
  assert.equal(spanGrounded("the actor's \"device code\" flow - abused", pdf), true);
});

test("empty source_span is a no-op (grounded)", () => {
  assert.equal(spanGrounded("", normalize("anything")), true);
  assert.equal(spanGrounded("   ", normalize("anything")), true);
});

test("fabricated span is dropped, real span survives", () => {
  const raw =
    "Storm-2372 sent phishing links resolving to devicelogin.microsoft.com. " +
    "The C2 used login.microsoftonline.com token grants.";
  const extraction = {
    behavioral_patterns: [
      {
        sequence: "device-code phishing",
        observables: [
          {
            field_type: "domain",
            pattern: "devicelogin.microsoft.com",
            source_span: "resolving to devicelogin.microsoft.com",
            confidence: 0.9,
          },
          {
            field_type: "ip",
            pattern: "185.220.101.33", // NOT in the source text
            source_span: "beaconed to 185.220.101.33 every 60s",
            confidence: 0.8,
          },
        ],
      },
    ],
    tools: ["curl"],
    malware: [],
    unbound_iocs: [
      {
        field_type: "domain",
        pattern: "login.microsoftonline.com",
        source_span: "used login.microsoftonline.com token grants",
        confidence: 0.7,
      },
    ],
  };

  const g = groundExtraction(extraction, raw);
  // The fabricated IP span is dropped.
  assert.equal(g.behavioral_patterns[0].observables.length, 1);
  assert.equal(g.behavioral_patterns[0].observables[0].pattern, "devicelogin.microsoft.com");
  // The real unbound IOC survives.
  assert.equal(g.unbound_iocs.length, 1);
  // The dropped one is surfaced, not silently swallowed.
  assert.equal(g._dropped_ungrounded.length, 1);
  assert.equal(g._dropped_ungrounded[0].pattern, "185.220.101.33");
});
