// LIVE smoke: drives the ACTUAL tool code path (runExtraction -> real Anthropic
// API -> parse -> ground -> atomic + transcribe) on each advisory PDF. This is
// the same pipeline the browser runs; only the DOM render is omitted (page.jsx
// just maps this exact result object). Costs real LLM tokens.
//
// Key: read from ktlyst-hub/product-baseline/.env (local), NOT printed.
// Usage: node scripts/smoke-live.mjs [--fast] [pdf ...]

import fs from "node:fs/promises";
import path from "node:path";
import { runExtraction, MODELS } from "../app/lib/extractLoop.js";
import { normalize } from "../app/lib/grounding.mjs";

const args = process.argv.slice(2);
const fast = args.includes("--fast");
const pdfArgs = args.filter((a) => !a.startsWith("--"));

const ART = path.resolve(process.env.HOME, "projects/ktlyst-hub/product-baseline/artifacts");
const DEFAULT = [
  "unit42_device_code_phishing.pdf",
  "openssh_authbypass.pdf",
  "shinyhunters_threat_brief.pdf",
  "cyber_triage_dfir.pdf",
].map((f) => path.join(ART, f));
const PDFS = pdfArgs.length ? pdfArgs : DEFAULT;

async function loadKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const envPath = path.resolve(process.env.HOME, "projects/ktlyst-hub/product-baseline/.env");
  const txt = await fs.readFile(envPath, "utf8");
  const m = txt.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+)\s*$/m);
  if (!m) throw new Error("ANTHROPIC_API_KEY not found in .env");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

async function pdfToText(absPath) {
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

// Independent re-check against the ACTUAL v007 contract: containment is on
// NORMALIZED text (whitespace/hyphen-wrap/typography folded), exactly as
// grounding.mjs defines "grounded". A raw substring check would be STRICTER than
// v007 and false-alarm on legitimate PDF hyphen-wraps (e.g. "foo- bar" across a
// line break). Proven here against a REAL LLM extraction, not a fixture.
function auditGrounding(r, text) {
  const pdfNorm = normalize(text);
  const problems = [];
  for (const a of r.atomic_rules ?? []) {
    if (!pdfNorm.includes(normalize(a.value))) problems.push(`atomic value not grounded in source: ${a.value}`);
    if (!a.rule_yaml.includes(a.value)) problems.push(`atomic value not in its own yaml: ${a.value}`);
  }
  for (const t of r.transcribed_rules ?? []) {
    if (!pdfNorm.includes(normalize(t.text))) problems.push(`transcribed rule not grounded in source (${t.kind})`);
  }
  return problems;
}

async function main() {
  const apiKey = await loadKey();
  const model = fast ? MODELS.fast : MODELS.best;
  let totalCost = 0;
  let failures = 0;

  for (const pdf of PDFS) {
    const name = path.basename(pdf);
    try {
      const text = await pdfToText(pdf);
      const r = await runExtraction({ apiKey, model, documentText: text });
      totalCost += r.meta.cost_usd;

      const kinds = (r.transcribed_rules ?? []).reduce(
        (a, x) => ((a[x.kind] = (a[x.kind] || 0) + 1), a),
        {},
      );
      const atomicByType = (r.atomic_rules ?? []).reduce(
        (a, x) => ((a[x.field_type] = (a[x.field_type] || 0) + 1), a),
        {},
      );
      const problems = auditGrounding(r, text);

      console.log(`\n=== ${name} (${text.length} chars · ${r.meta.model}) ===`);
      console.log(`  exec_summary:${r.exec_summary.length} actors:${r.actors.length} patterns:${r.behavioral_patterns.length} iocs:${r.unbound_iocs.length} dropped:${r.dropped_ungrounded.length}`);
      console.log(`  ATOMIC rules: ${r.atomic_rules.length} ${JSON.stringify(atomicByType)}`);
      console.log(`  TRANSCRIBED rules: ${r.transcribed_rules.length} ${JSON.stringify(kinds)}`);
      if (r.atomic_rules[0]) {
        console.log(`  sample atomic (${r.atomic_rules[0].field_type} -> ${r.atomic_rules[0].category}):`);
        console.log(r.atomic_rules[0].rule_yaml.split("\n").map((l) => "    " + l).join("\n"));
      }
      console.log(`  cost: $${r.meta.cost_usd}`);
      if (problems.length) {
        console.log(`  !! GROUNDING PROBLEMS:`);
        problems.forEach((p) => console.log(`     - ${p}`));
        failures += problems.length;
      } else {
        console.log(`  grounding audit: CLEAN (every atomic value + transcribed rule verbatim in source)`);
      }
    } catch (e) {
      console.log(`\n=== ${name} ===\n  !! ERROR: ${e.message}`);
      failures++;
    }
  }

  console.log(`\n--- total LLM cost: $${totalCost.toFixed(4)} ---`);
  console.log(failures === 0 ? "LIVE SMOKE: ALL GREEN" : `LIVE SMOKE: ${failures} PROBLEM(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
