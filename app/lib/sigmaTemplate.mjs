// Atomic Sigma templating — Feature 2 of PRD-002. The deterministic analog of
// grounding.mjs: the LLM never authors these rules. A FIXED field_type ->
// logsource/field/match table slots a GROUNDED IOC value into a FIXED Sigma
// shape. There is NO detection logic here — one field, one value, one condition.
// The moment a rule needs multi-field / sequence / threshold / timeframe logic,
// it is out of scope (that is the big tool's LLM+council+pySigma wedge).
//
// Honesty contract (PRD-002 §4): these are IOC SWEEP snippets ("fire on this
// exact bad domain/hash/IP"), useful for a hunt, NOT sophisticated detection,
// NOT deployable. The assumed logsource/field is a guess surfaced on each card.

import { normalize } from "./grounding.mjs";
import { refang } from "./iocExtract.mjs";

// FIELD_MAP is the single source of truth for the atomic mapping. Every entry is
// taxonomy-backed against SigmaHQ (category + field names as SigmaHQ writes them).
// `match` is a FIXED modifier per field_type (identical for every advisory) — it
// is part of the table, not a per-rule judgment. field_types absent here (email,
// user_agent, oauth_scope, http_method, network_connection) produce NO rule.
export const FIELD_MAP = {
  domain: { category: "dns_query", field: "QueryName", match: "exact" },
  ip: { category: "network_connection", field: "DestinationIp", match: "exact" },
  url: { category: "proxy", field: "c-uri", match: "contains" },
  file_hash: { category: "process_creation", field: "Hashes", match: "contains" },
  process: { category: "process_creation", field: "Image", match: "endswith" },
  command_line: { category: "process_creation", field: "CommandLine", match: "contains" },
  registry: { category: "registry_event", field: "TargetObject", match: "exact" },
};

// The taxonomy allowlist — the set of Sigma logsource categories this templater
// may emit. Exported so the test suite can assert no rule ever leaves it.
export const ALLOWED_CATEGORIES = Object.freeze([
  ...new Set(Object.values(FIELD_MAP).map((m) => m.category)),
]);

// Render ANY dynamic string as a double-quoted, fully-escaped scalar.
// JSON.stringify emits a JSON double-quoted string, which a YAML parser reads as
// a double-quoted scalar with the same escapes (\" \\ \n \t \uXXXX). Verified
// round-trip through js-yaml for every hostile class we care about — ':' '"' '\'
// newlines, leading '!' '&' '*' '-' '#', '{x: y}', DEL/C1 controls, U+FFFE,
// lone surrogates, U+2028/2029 (see sigmaTemplate.test.mjs). Dynamic values are
// NEVER interpolated into keys, only into quoted scalar values, so no key can be
// hijacked. No runtime YAML dependency.
export function yamlScalar(v) {
  return JSON.stringify(String(v ?? ""));
}

// The detection key for a field: exact -> bare field; otherwise `field|modifier`.
// (`Image|endswith`, `c-uri|contains` — standard Sigma field-modifier syntax.)
function detectionKey(field, match) {
  return match === "exact" ? field : `${field}|${match}`;
}

// Build the atomic Sigma rule OBJECT for one observable, or null if it must not
// render. Null when: field_type is unmapped, the value is empty, OR the grounding
// gate fails. The gate (PRD-002 §2 F2) closes the empty-span hole that spanGrounded
// alone leaves open (empty span => grounded=true): a value ships ONLY when its
// source_span is non-empty, IS grounded in the PDF, AND the value is contained in
// that span (evidenced by its OWN citation, not merely present somewhere).
export function atomicSigmaForObservable(obs, pdfText) {
  const map = FIELD_MAP[obs?.field_type];
  if (!map) return null;

  const value = String(obs.pattern ?? "").trim();
  if (!value) return null;

  const span = String(obs.source_span ?? "");
  const pdfNorm = normalize(pdfText);
  const spanNorm = normalize(span);
  const valueNorm = normalize(value);
  // Reject when the span OR the value normalizes to empty. This closes both the
  // empty-span hole (spanGrounded("") returns true) AND the U+200B-only bypass:
  // normalize() folds ZWSP/whitespace to "", so a "​" span/value is empty
  // here even though String.trim() would keep it.
  if (!spanNorm || !valueNorm) return null;
  if (!pdfNorm.includes(spanNorm)) return null; // span verbatim in the doc
  // Value evidenced by its span. Refang-aware (PRD-003 F5 / Codex F1): a huntable
  // value is the REAL indicator (evil.com), but a defanged span cites evil[.]com.
  // Refang the span (the deterministic direction — one canonical target) and accept
  // if the value is contained in either the raw or the refanged span. The rendered
  // rule value stays the real indicator; the card still shows the defanged span.
  const spanRefangedNorm = normalize(refang(span));
  if (!spanNorm.includes(valueNorm) && !spanRefangedNorm.includes(valueNorm)) return null;

  return {
    field_type: obs.field_type,
    value,
    source_span: span,
    category: map.category,
    field: map.field,
    match: map.match,
    title: `IOC sweep — ${obs.field_type}: ${value}`,
  };
}

// Render a rule object (from atomicSigmaForObservable) to a deterministic Sigma
// YAML string. Stable key order; every dynamic scalar via yamlScalar; static keys
// only. The shape is intentionally minimal and vendor-neutral.
export function renderSigmaYaml(rule) {
  const key = detectionKey(rule.field, rule.match);
  return [
    `title: ${yamlScalar(rule.title)}`,
    `status: experimental`,
    `description: ${yamlScalar(
      "Single-field IOC sweep generated from a grounded observable. " +
        "Starting point, not a deployable detection. The assumed logsource/field " +
        "is a guess — tune it, and false positives, for your environment before use.",
    )}`,
    `logsource:`,
    `  category: ${rule.category}`,
    `detection:`,
    `  selection:`,
    `    ${key}: ${yamlScalar(rule.value)}`,
    `  condition: selection`,
    `level: medium`,
    ``,
  ].join("\n");
}

// Map a GROUNDED extraction (behavioral_patterns[].observables + unbound_iocs) to
// a deduped, stably-sorted array of atomic rules. Input is the grounded set — an
// ungrounded value is already gone — but we re-run the per-value grounding gate
// so an empty-span survivor still cannot produce a rule.
export function atomicRulesFromExtraction(grounded, pdfText) {
  const observables = [
    ...(grounded?.behavioral_patterns ?? []).flatMap((p) => p.observables ?? []),
    ...(grounded?.unbound_iocs ?? []),
  ];

  const seen = new Set();
  const rules = [];
  for (const obs of observables) {
    const rule = atomicSigmaForObservable(obs, pdfText);
    if (!rule) continue;
    const dedupeKey = JSON.stringify([
      rule.field_type,
      normalize(rule.value),
      rule.category,
      rule.field,
    ]);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    rules.push({
      rule_yaml: renderSigmaYaml(rule),
      field_type: rule.field_type,
      value: rule.value,
      source_span: rule.source_span,
      category: rule.category,
      field: rule.field,
      match: rule.match,
    });
  }

  // Deterministic order: field_type, then value, then source_span. Codepoint
  // compare (not localeCompare — that varies by locale/ICU data across hosts).
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  rules.sort(
    (a, b) =>
      cmp(a.field_type, b.field_type) ||
      cmp(a.value, b.value) ||
      cmp(a.source_span, b.source_span),
  );
  return rules;
}
