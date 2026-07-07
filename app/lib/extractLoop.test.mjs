// PRD-003 integration tests — the deterministic loop end to end. Covers the F1
// refang-aware sweep, the F13 no-network guarantee, and the §2.0 slice invariant
// across every extractor output.

import { test } from "node:test";
import assert from "node:assert/strict";
import { runExtraction } from "./extractLoop.js";

const GAZ = {
  actors: [{ name: "APT29", aliases: ["Cozy Bear"] }],
  tools: [{ name: "Cobalt Strike", aliases: [] }],
  malware: [{ name: "Emotet", aliases: [] }],
  techniques: { T1566: "Phishing" },
};

const SAMPLE = [
  "APT29 used Cobalt Strike to drop Emotet.",
  "Initial access mapped to T1566.",
  "C2 over hxxps://evil[.]com/beacon and backup evil2[.]net.",
  "Callback IP 8.8.8.8. Hash e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.",
].join("\n");

test("F1: defanged IOCs produce sweep rules with the REAL indicator value", async () => {
  const r = await runExtraction({ documentText: SAMPLE, gazetteer: GAZ, stoplist: [] });
  const urlRule = r.atomic_rules.find((x) => x.field_type === "url");
  assert.ok(urlRule, "expected a url sweep rule");
  assert.equal(urlRule.value, "https://evil.com/beacon"); // refanged, huntable
  assert.equal(urlRule.source_span, "hxxps://evil[.]com/beacon"); // defanged evidence
  assert.match(urlRule.rule_yaml, /https:\/\/evil\.com\/beacon/);

  const domRule = r.atomic_rules.find((x) => x.field_type === "domain");
  assert.ok(domRule, "expected a domain sweep rule from defanged evil2[.]net");
  assert.equal(domRule.value, "evil2.net");
});

test("deterministic composition finds entities, ids, iocs", async () => {
  const r = await runExtraction({ documentText: SAMPLE, gazetteer: GAZ, stoplist: [] });
  assert.equal(r.entities.actors[0]?.name, "APT29");
  assert.equal(r.entities.tools[0]?.name, "Cobalt Strike");
  assert.equal(r.entities.malware[0]?.name, "Emotet");
  assert.ok(r.attack_ids.some((a) => a.id === "T1566" && a.in_attack));
  assert.ok(r.iocs.some((i) => i.field_type === "ip" && i.value === "8.8.8.8"));
  assert.ok(r.iocs.some((i) => i.field_type === "file_hash"));
  assert.equal(r.meta.counts.iocs, r.iocs.length);
});

test("F13: runExtraction needs NO network — runs with fetch stubbed to throw", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("network access is forbidden in the deterministic runtime");
  };
  try {
    const r = await runExtraction({ documentText: SAMPLE, gazetteer: GAZ, stoplist: [] });
    assert.ok(r.iocs.length > 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("§2.0: every emitted item's span is byte-for-byte text.slice(start,end)", async () => {
  const r = await runExtraction({ documentText: SAMPLE, gazetteer: GAZ, stoplist: [] });
  const check = (start, end, span, label) => {
    assert.equal(SAMPLE.slice(start, end), span, `slice != span (${label})`);
    assert.ok(span.trim().length > 0, `empty span (${label})`);
  };
  for (const i of r.iocs) check(i.start, i.end, i.source_span, `ioc ${i.value}`);
  for (const a of r.attack_ids) check(a.start, a.end, a.source_span, `attack ${a.id}`);
  for (const group of [r.entities.actors, r.entities.tools, r.entities.malware]) {
    for (const e of group) for (const s of e.spans) check(s.start, s.end, s.source_span, `entity ${e.name}`);
  }
});

test("runExtraction is opinion-free: no summary / detection / confidence keys", async () => {
  const r = await runExtraction({ documentText: SAMPLE, gazetteer: GAZ, stoplist: [] });
  assert.equal(r.exec_summary, undefined);
  assert.equal(r.behavioral_patterns, undefined);
  assert.equal(JSON.stringify(r).includes("detection_idea"), false);
  assert.equal(JSON.stringify(r).includes("confidence"), false);
});
