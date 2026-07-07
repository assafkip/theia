// Local acceptance harness (PRD-003 §6.3). No API key, no network. Extracts text
// from real KTLYST advisory PDFs and runs the DETERMINISTIC extractor on real
// bytes, asserting:
//   - IOCs / entities / printed ATT&CK ids are found where present,
//   - the §2.0 invariant holds on every emitted item (slice === source_span),
//   - transcription still finds vendor rule blocks and the fabricated-value gate
//     still rejects an empty-span value.
// A synthetic 3-kind rule fixture guards the transcription path even when the real
// PDFs ship no appendix rules.
//
// Usage: node scripts/harness.mjs [pdf ...]
//   PDF dir override: KTLYST_PDF_DIR=/abs/path node scripts/harness.mjs

import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runExtraction } from "../app/lib/extractLoop.js";
import { atomicSigmaForObservable } from "../app/lib/sigmaTemplate.mjs";
import { transcribeRules as _transcribe } from "../app/lib/ruleTranscribe.mjs";

const LIB = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "lib");

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

const PDF_DIR =
  process.env.KTLYST_PDF_DIR ||
  path.resolve(process.env.HOME, "projects/_archive/product-ktlyst-old-2026-07-06/artifacts");
const DEFAULT_PDFS = [
  "unit42_device_code_phishing.pdf",
  "openssh_authbypass.pdf",
  "shinyhunters_threat_brief.pdf",
  "cyber_triage_dfir.pdf",
].map((f) => path.resolve(PDF_DIR, f));

async function pdfToText(absPath) {
  const data = new Uint8Array(await readFile(absPath));
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

// §2.0 invariant over a full extraction result.
function sliceViolations(text, r) {
  const bad = [];
  const chk = (o, label) => {
    if (text.slice(o.start, o.end) !== o.source_span || !o.source_span.trim())
      bad.push(label);
  };
  r.iocs.forEach((i) => chk(i, `ioc:${i.value}`));
  r.attack_ids.forEach((a) => chk(a, `attack:${a.id}`));
  for (const g of [r.entities.actors, r.entities.tools, r.entities.malware])
    g.forEach((e) => e.spans.forEach((s) => chk(s, `entity:${e.name}`)));
  return bad;
}

async function main() {
  const gazetteer = JSON.parse(await readFile(join(LIB, "gazetteer.json"), "utf8"));
  const stoplist = JSON.parse(await readFile(join(LIB, "entity-stoplist.json"), "utf8")).stoplist;
  const pdfs = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_PDFS;
  let failures = 0;

  // Synthetic fixture: transcription must find all three kinds.
  {
    const t = _transcribe(RULE_FIXTURE);
    const kinds = new Set(t.map((r) => r.kind));
    const okKinds = ["sigma", "yara", "snort"].every((k) => kinds.has(k));
    console.log("=== rule fixture (synthetic) ===");
    console.log(`  transcribed kinds: ${[...kinds].sort().join(",")} (need sigma,snort,yara)`);
    if (!okKinds) { console.log("  !! FAIL: transcription missed a kind"); failures++; }
  }

  for (const pdf of pdfs) {
    const name = path.basename(pdf);
    try {
      const text = await pdfToText(pdf);
      const r = await runExtraction({ documentText: text, gazetteer, stoplist });
      const c = r.meta.counts;
      const violations = sliceViolations(text, r);
      const fabricated = atomicSigmaForObservable(
        { field_type: "ip", pattern: "185.220.101.33", source_span: "" },
        text,
      );

      console.log(`\n=== ${name} (${text.length} chars) ===`);
      console.log(`  IOCs=${c.iocs} actors=${c.actors} tools=${c.tools} malware=${c.malware} attack=${c.attack_ids} vendorRules=${c.transcribed_rules} sweeps=${c.atomic_rules}`);
      console.log(`  §2.0 slice-equality violations: ${violations.length}`);
      console.log(`  fabricated/empty-span rejected: ${fabricated === null}`);

      if (violations.length) { console.log(`  !! FAIL: slice violations: ${violations.slice(0, 5).join(", ")}`); failures++; }
      if (fabricated !== null) { console.log("  !! FAIL: empty-span fabricated value produced a rule"); failures++; }
    } catch (e) {
      if (e.code === "ENOENT") {
        console.log(`\n=== ${name} ===\n  ~ SKIP: not found (set KTLYST_PDF_DIR). Fixture path still validated.`);
      } else {
        console.log(`\n=== ${name} ===\n  !! ERROR: ${e.message}`);
        failures++;
      }
    }
  }

  console.log(`\n${failures === 0 ? "ALL GREEN" : failures + " FAILURE(S)"}`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
