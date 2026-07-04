// Local acceptance harness (PRD-002 §6.4). No API key, no network. Extracts text
// from real KTLYST advisory PDFs and exercises BOTH deterministic detection-rule
// paths on real bytes:
//   - transcribeRules: finds any Sigma/YARA/Snort blocks the advisory shipped.
//   - atomic Sigma: builds synthetic grounded observables from real slices of the
//     PDF text (value verbatim in its span) and confirms rules emit + the gate
//     rejects a fabricated value. (The LLM-driven atomic path is covered by unit
//     tests + the live manual check; this proves the deterministic core on real
//     advisory text without a key.)
//
// Usage: node scripts/harness.mjs [pdf ...]
// Defaults to the 4 advisories under ktlyst-hub if no paths are given.

import path from "node:path";
import {
  atomicSigmaForObservable,
  atomicRulesFromExtraction,
} from "../app/lib/sigmaTemplate.mjs";
import { transcribeRules as _transcribe } from "../app/lib/ruleTranscribe.mjs";

// A fixture that ships one of each rule kind, so the transcription path is
// exercised even when the real PDFs carry no appendix rules (a silent
// transcription regression would otherwise false-green the whole harness).
const RULE_FIXTURE = [
  "```yaml",
  "title: Fixture sigma",
  "logsource:",
  "  category: process_creation",
  "detection:",
  "  selection:",
  "    Image|endswith: '\\evil.exe'",
  "  condition: selection",
  "```",
  "",
  "```",
  "rule Fixture_Yara {",
  '  strings: $s = "evil{payload}"',
  "  condition: $s",
  "}",
  "```",
  "",
  'alert tcp any any -> any 443 (msg:"fixture"; sid:424242; rev:1;)',
].join("\n");

const DEFAULT_PDFS = [
  "unit42_device_code_phishing.pdf",
  "openssh_authbypass.pdf",
  "shinyhunters_threat_brief.pdf",
  "cyber_triage_dfir.pdf",
].map((f) =>
  path.resolve(
    process.env.HOME,
    "projects/ktlyst-hub/product-baseline/artifacts",
    f,
  ),
);

// pdfjs-dist legacy build extracts text in Node (same lib the browser uses).
async function pdfToText(absPath) {
  const fs = await import("node:fs/promises");
  const data = new Uint8Array(await fs.readFile(absPath));
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    out += content.items.map((it) => it.str).join(" ") + "\n";
  }
  return out;
}

// Build a synthetic grounded observable from a real substring of the text.
function firstGroundedSample(text) {
  // Pick a domain-looking token that actually appears, and use its surrounding
  // window as the source_span (so value is contained in its span).
  const m = text.match(/[a-z0-9][a-z0-9.-]{4,}\.[a-z]{2,}(?![@\w])/i);
  if (!m) return null;
  const value = m[0];
  const idx = m.index;
  const span = text.slice(Math.max(0, idx - 20), idx + value.length + 20);
  return { field_type: "domain", pattern: value, source_span: span, confidence: 0.9 };
}

async function main() {
  const pdfs = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_PDFS;
  let failures = 0;

  // Fixture sweep: transcription must find all three kinds, and the WIRED atomic
  // path (atomicRulesFromExtraction, the exact call + object shape page.jsx
  // consumes) must emit a well-formed rule from a grounded extraction.
  {
    const t = _transcribe(RULE_FIXTURE);
    const kinds = new Set(t.map((r) => r.kind));
    const okKinds = ["sigma", "yara", "snort"].every((k) => kinds.has(k));
    const groundedExtraction = {
      behavioral_patterns: [
        {
          observables: [
            { field_type: "domain", pattern: "evil.example.com", source_span: "c2 was evil.example.com here", confidence: 0.9 },
          ],
        },
      ],
      unbound_iocs: [],
    };
    const wired = atomicRulesFromExtraction(groundedExtraction, "c2 was evil.example.com here");
    const shapeOk =
      wired.length === 1 &&
      typeof wired[0].rule_yaml === "string" &&
      wired[0].field_type === "domain" &&
      wired[0].category === "dns_query";
    console.log("=== rule fixture (synthetic) ===");
    console.log(`  transcribed kinds: ${[...kinds].sort().join(",")} (need sigma,snort,yara)`);
    console.log(`  atomicRulesFromExtraction wired shape ok: ${shapeOk}`);
    if (!okKinds) { console.log("  !! FAIL: transcription missed a kind"); failures++; }
    if (!shapeOk) { console.log("  !! FAIL: wired atomic path shape wrong"); failures++; }
  }

  for (const pdf of pdfs) {
    const name = path.basename(pdf);
    try {
      const text = await pdfToText(pdf);
      const transcribed = _transcribe(text);
      const kinds = transcribed.reduce((a, r) => ((a[r.kind] = (a[r.kind] || 0) + 1), a), {});

      // Atomic: real grounded sample emits; a fabricated value does NOT.
      const sample = firstGroundedSample(text);
      const emitted = sample ? atomicSigmaForObservable(sample, text) : null;
      const fabricated = atomicSigmaForObservable(
        { field_type: "ip", pattern: "185.220.101.33", source_span: "" },
        text,
      );

      // Every transcribed slice must be verbatim in the source (byte-for-byte).
      const allVerbatim = transcribed.every((r) => text.includes(r.text));

      console.log(`\n=== ${name} (${text.length} chars) ===`);
      console.log(`  transcribed rules: ${transcribed.length} ${JSON.stringify(kinds)}`);
      console.log(`  all transcribed verbatim in source: ${allVerbatim}`);
      console.log(`  atomic sample emitted: ${!!emitted}${sample ? ` (${sample.pattern})` : " (no domain token found)"}`);
      console.log(`  fabricated/empty-span rejected: ${fabricated === null}`);

      if (!allVerbatim) { console.log("  !! FAIL: a transcribed rule is not verbatim in source"); failures++; }
      if (fabricated !== null) { console.log("  !! FAIL: empty-span fabricated value produced a rule"); failures++; }
      if (sample && !emitted) { console.log("  !! FAIL: a grounded sample did not emit a rule"); failures++; }
    } catch (e) {
      console.log(`\n=== ${name} ===\n  !! ERROR: ${e.message}`);
      failures++;
    }
  }

  console.log(`\n${failures === 0 ? "ALL GREEN" : failures + " FAILURE(S)"}`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
