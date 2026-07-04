// Ship gate for the atomic Sigma templater (PRD-002 Feature 2). Runs with
// `node --test` — no API key, no network. js-yaml is a devDependency used ONLY
// here to PROVE the emitted YAML parses and round-trips (the app ships no YAML
// dep). The critical test is the empty-span grounding hole: an ungrounded value
// with an empty source_span must produce NO rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import { load as yamlLoad } from "js-yaml";
import {
  FIELD_MAP,
  ALLOWED_CATEGORIES,
  yamlScalar,
  atomicSigmaForObservable,
  renderSigmaYaml,
  atomicRulesFromExtraction,
} from "./sigmaTemplate.mjs";

// A PDF whose text contains every value we template below, each in a real span.
const PDF = [
  "The actor beaconed to evil.example.com over DNS.",
  "C2 resolved to 203.0.113.45 repeatedly.",
  "Victims fetched http://bad.example.com/payload.bin.",
  "Dropper hash was 44d88612fea8a8f36de82e1278abb02f in the sample set.",
  "It spawned powershell.exe with -enc dGVzdA== on the host.",
  "Persistence wrote HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\evil.",
].join("\n");

function obs(field_type, pattern, source_span) {
  return { field_type, pattern, source_span, confidence: 0.9 };
}

// One grounded observable per mapped field_type, each value verbatim in its span.
const MAPPED = {
  domain: obs("domain", "evil.example.com", "beaconed to evil.example.com over DNS"),
  ip: obs("ip", "203.0.113.45", "C2 resolved to 203.0.113.45 repeatedly"),
  url: obs("url", "http://bad.example.com/payload.bin", "fetched http://bad.example.com/payload.bin"),
  file_hash: obs("file_hash", "44d88612fea8a8f36de82e1278abb02f", "hash was 44d88612fea8a8f36de82e1278abb02f in the sample"),
  process: obs("process", "powershell.exe", "spawned powershell.exe with -enc"),
  command_line: obs("command_line", "-enc dGVzdA==", "powershell.exe with -enc dGVzdA== on the host"),
  registry: obs("registry", "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\evil", "wrote HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\evil"),
};

test("every mapped field_type produces a parseable Sigma rule with required keys", () => {
  for (const [ft, o] of Object.entries(MAPPED)) {
    const rule = atomicSigmaForObservable(o, PDF);
    assert.ok(rule, `${ft} should produce a rule`);
    const doc = yamlLoad(rule && renderSigmaYaml(rule)); // must parse
    assert.equal(typeof doc.title, "string");
    assert.ok(doc.logsource && typeof doc.logsource.category === "string");
    assert.equal(doc.detection.condition, "selection");
    const selKeys = Object.keys(doc.detection.selection);
    assert.equal(selKeys.length, 1, `${ft} selection has exactly one field`);
  }
});

test("FIELD_MAP matches an INDEPENDENT expected taxonomy table (catches typos)", () => {
  // Hardcoded separately from FIELD_MAP so a typo like dns_qury cannot self-approve.
  const EXPECTED = {
    domain: { category: "dns_query", field: "QueryName", match: "exact" },
    ip: { category: "network_connection", field: "DestinationIp", match: "exact" },
    url: { category: "proxy", field: "c-uri", match: "contains" },
    file_hash: { category: "process_creation", field: "Hashes", match: "contains" },
    process: { category: "process_creation", field: "Image", match: "endswith" },
    command_line: { category: "process_creation", field: "CommandLine", match: "contains" },
    registry: { category: "registry_event", field: "TargetObject", match: "exact" },
  };
  assert.deepEqual(FIELD_MAP, EXPECTED);
});

test("emitted logsource.category + field match the FIELD_MAP entry (taxonomy allowlist)", () => {
  for (const [ft, o] of Object.entries(MAPPED)) {
    const map = FIELD_MAP[ft];
    const doc = yamlLoad(renderSigmaYaml(atomicSigmaForObservable(o, PDF)));
    assert.equal(doc.logsource.category, map.category, `${ft} category`);
    assert.ok(ALLOWED_CATEGORIES.includes(doc.logsource.category), `${ft} category in allowlist`);
    // The single selection key starts with the mapped field (bare or field|mod).
    const key = Object.keys(doc.detection.selection)[0];
    assert.ok(key === map.field || key.startsWith(`${map.field}|`), `${ft} field ${key}`);
    if (map.match !== "exact") assert.ok(key.endsWith(`|${map.match}`), `${ft} modifier`);
  }
});

test("CRITICAL: empty source_span + fabricated pattern produces NO rule", () => {
  // spanGrounded("") returns true — this is the hole. The atomic gate must still
  // reject because the span is empty (nothing evidences the value).
  const fabricated = obs("ip", "185.220.101.33", ""); // 185.x NOT in PDF, empty span
  assert.equal(atomicSigmaForObservable(fabricated, PDF), null);
});

test("CRITICAL: U+200B-only span/value (normalizes to empty) produces NO rule", () => {
  // normalize() folds ZWSP to "" — String.trim() would NOT. The gate must reject.
  const zwsp = "​";
  assert.equal(atomicSigmaForObservable(obs("ip", zwsp, zwsp), PDF), null);
  assert.equal(atomicSigmaForObservable(obs("ip", "203.0.113.45", zwsp), PDF), null);
});

test("value whose span is NOT verbatim in the PDF produces NO rule", () => {
  const ungrounded = obs("domain", "evil.example.com", "a span that is not in the document at all");
  assert.equal(atomicSigmaForObservable(ungrounded, PDF), null);
});

test("value NOT contained in its own (grounded) span produces NO rule", () => {
  // The span IS in the PDF, but the claimed value is not inside that span.
  const mismatch = obs("ip", "10.10.10.10", "C2 resolved to 203.0.113.45 repeatedly");
  assert.equal(atomicSigmaForObservable(mismatch, PDF), null);
});

test("unmapped field_type produces NO rule", () => {
  for (const ft of ["email", "user_agent", "oauth_scope", "http_method", "network_connection"]) {
    const o = obs(ft, "anything", "anything appears here");
    assert.equal(atomicSigmaForObservable({ ...o }, "anything appears here"), null);
  }
});

test("empty / missing pattern produces NO rule", () => {
  assert.equal(atomicSigmaForObservable(obs("domain", "", "evil.example.com"), PDF), null);
  assert.equal(atomicSigmaForObservable(obs("domain", "   ", "evil.example.com"), PDF), null);
});

test("adversarial IOC values render to YAML that parses and round-trips the value", () => {
  const hostile = [
    'a: b',            // colon-space (YAML mapping trap)
    'he said "hi"',    // quotes
    "path\\to\\evil",  // backslashes
    "line1\nline2",    // newline
    "# not a comment", // leading hash
    "- not a list",    // leading dash
    "!Tag value",      // leading YAML tag char
    "&anchor",         // leading anchor char
    "*alias",          // leading alias char
    "{x: y}",          // flow-mapping-looking
    "z".repeat(5000),  // very long
    "del\u007Fhere",   // DEL control
    "c1\u0085next",    // C1 control (NEL)
    "bom\uFFFEmark",   // U+FFFE noncharacter
    "ls\u2028ps\u2029",// line/paragraph separators
    "lone\ud800surr",  // lone high surrogate
  ];
  for (const v of hostile) {
    // yamlScalar directly parses back to the exact value.
    assert.equal(yamlLoad(yamlScalar(v)), v, `yamlScalar round-trip: ${JSON.stringify(v).slice(0, 40)}`);
    // And inside a full rendered rule, the selection value round-trips.
    const rule = {
      field_type: "domain", value: v, source_span: v,
      category: "dns_query", field: "QueryName", match: "exact", title: `t ${v}`,
    };
    const doc = yamlLoad(renderSigmaYaml(rule));
    assert.equal(doc.detection.selection.QueryName, v);
    assert.equal(doc.title, `t ${v}`);
  }
});

test("dedupe collapses identical values; stable sort by field_type/value/span", () => {
  const grounded = {
    behavioral_patterns: [{ observables: [MAPPED.ip, MAPPED.domain, MAPPED.ip] }],
    unbound_iocs: [MAPPED.domain, MAPPED.url],
  };
  const rules = atomicRulesFromExtraction(grounded, PDF);
  // domain appears twice, ip twice -> deduped to one each; url once. 4 unique -> 3.
  const kinds = rules.map((r) => `${r.field_type}:${r.value}`);
  assert.equal(new Set(kinds).size, kinds.length, "no duplicates");
  assert.equal(rules.length, 3);
  // Stable order: domain < ip < url alphabetically.
  assert.deepEqual(rules.map((r) => r.field_type), ["domain", "ip", "url"]);
});

test("atomicRulesFromExtraction skips ungrounded/empty-span survivors", () => {
  const grounded = {
    behavioral_patterns: [{
      observables: [
        MAPPED.domain,
        obs("ip", "185.220.101.33", ""),             // empty-span survivor
        obs("registry", "HKLM\\Nope", "nowhere text"), // ungrounded span
      ],
    }],
    unbound_iocs: [],
  };
  const rules = atomicRulesFromExtraction(grounded, PDF);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].field_type, "domain");
});
