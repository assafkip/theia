// Ship gate for rule transcription (PRD-002 Feature 1). Runs with `node --test`
// — no API key, no network. Proves: real fenced/unfenced Sigma/YARA/Snort blocks
// are pulled BYTE-FOR-BYTE and kind-classified; prose that merely mentions rule
// keywords is NOT captured; a block not verbatim in the source is rejected.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyRule,
  findRuleBlocks,
  groundRuleBlock,
  transcribeRules,
} from "./ruleTranscribe.mjs";
import { normalize } from "./grounding.mjs";

const SIGMA_FENCED = [
  "Detection guidance below.",
  "",
  "```yaml",
  "title: Suspicious device code auth",
  "logsource:",
  "  product: azure",
  "  service: signinlogs",
  "detection:",
  "  selection:",
  "    ResourceDisplayName: 'Microsoft Graph'",
  "  condition: selection",
  "level: medium",
  "```",
  "",
  "End of section.",
].join("\n");

const YARA_FENCED = [
  "Appendix A - YARA.",
  "",
  "```",
  "rule Evil_Dropper",
  "{",
  "  strings:",
  "    $a = { 4d 5a 90 00 }",
  "    $s = \"evil{payload}\"",
  "  condition:",
  "    $a at 0 and $s",
  "}",
  "```",
].join("\n");

const SNORT_LINE = [
  "Network signature:",
  "",
  'alert tcp any any -> any 443 (msg:"Evil beacon"; content:"evil"; sid:1000001; rev:1;)',
  "",
].join("\n");

const SIGMA_UNFENCED = [
  "Some prose here about the campaign.",
  "",
  "title: Unfenced sigma rule",
  "logsource:",
  "  category: process_creation",
  "detection:",
  "  selection:",
  "    Image|endswith: '\\evil.exe'",
  "  condition: selection",
  "",
  "",
  "More prose after two blank lines.",
].join("\n");

test("fenced Sigma block is transcribed, classified, byte-for-byte", () => {
  const rules = transcribeRules(SIGMA_FENCED);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].kind, "sigma");
  // The exact raw slice is a substring of the source (newlines/indent preserved).
  assert.ok(SIGMA_FENCED.includes(rules[0].text));
  assert.match(rules[0].text, /title: Suspicious device code auth/);
  assert.match(rules[0].text, /condition: selection/);
});

test("fenced YARA block captured with balanced braces (incl. nested/string braces)", () => {
  const rules = transcribeRules(YARA_FENCED);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].kind, "yara");
  assert.ok(YARA_FENCED.includes(rules[0].text));
  // The whole rule through the final closing brace is captured.
  assert.match(rules[0].text, /rule Evil_Dropper/);
  assert.match(rules[0].text, /\$a at 0 and \$s/);
  assert.ok(rules[0].text.trim().endsWith("}"));
});

test("Snort line captured (alert + sid)", () => {
  const rules = transcribeRules(SNORT_LINE);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].kind, "snort");
  assert.match(rules[0].text, /sid:1000001/);
});

test("unfenced Sigma (title+detection+condition markers) is transcribed", () => {
  const rules = transcribeRules(SIGMA_UNFENCED);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].kind, "sigma");
  assert.match(rules[0].text, /title: Unfenced sigma rule/);
  // Capture stops before the trailing prose (two blank lines terminate it).
  assert.ok(!rules[0].text.includes("More prose after"));
});

test("prose that merely MENTIONS rule keywords is NOT captured", () => {
  const prose = [
    "The analyst set a title: for the report and wrote an alert to the team.",
    "There is no detection section, no sid, and no rule { } block here.",
    "We discuss condition and detection conceptually but ship no rule.",
  ].join("\n");
  assert.equal(transcribeRules(prose).length, 0);
});

test("classifyRule requires structure, not just a keyword", () => {
  assert.equal(classifyRule("we set a title: and an alert here"), null);
  assert.equal(classifyRule("title: x\ndetection:\n  sel: 1\n  condition: sel"), "sigma");
  assert.equal(classifyRule("rule R { condition: true }"), "yara");
  assert.equal(classifyRule('alert tcp any any -> any any (sid:5;)'), "snort");
});

test("a block NOT verbatim in the source is rejected by the grounding gate", () => {
  const block = { kind: "sigma", text: "title: fabricated\ndetection:\n  condition: x" };
  assert.equal(groundRuleBlock(block, "a document that never mentions that rule"), false);
  // But a block that IS in the source grounds true.
  const real = "title: real\ndetection:\n  condition: x";
  assert.equal(groundRuleBlock({ text: real }, `prose ${real} more prose`), true);
});

test("empty block text does not ground", () => {
  assert.equal(groundRuleBlock({ text: "" }, "anything"), false);
  assert.equal(groundRuleBlock({ text: "   " }, "anything"), false);
});

test("same rule fenced AND matched unfenced dedupes to one entry", () => {
  // SIGMA_FENCED's inner is also reachable by the unfenced sigma detector.
  const rules = transcribeRules(SIGMA_FENCED);
  assert.equal(rules.length, 1);
});

test("multiple distinct rules are all returned in document order", () => {
  const doc = [SNORT_LINE, SIGMA_FENCED, YARA_FENCED].join("\n\n---\n\n");
  const rules = transcribeRules(doc);
  const kinds = rules.map((r) => r.kind);
  assert.ok(kinds.includes("snort") && kinds.includes("sigma") && kinds.includes("yara"));
  // Snort appears first in the document.
  assert.equal(rules[0].kind, "snort");
});

test("no rules -> empty array", () => {
  assert.deepEqual(transcribeRules("Just a plain advisory with no rules at all."), []);
  assert.deepEqual(transcribeRules(""), []);
});

test("fenced offset: findRuleBlocks slice equals raw inner exactly (incl backticks/indent)", () => {
  const src = "pre\n```yaml\ntitle: x\n  nested: `tick`\ndetection:\n  condition: sel\n```\npost";
  const blocks = findRuleBlocks(src);
  const fenced = blocks.find((b) => b.kind === "sigma");
  assert.ok(fenced);
  assert.equal(src.slice(fenced.start, fenced.end), fenced.text); // exact byte slice
});

test("unfenced Sigma with an internal blank line is NOT truncated", () => {
  const doc = [
    "title: Rule with a gap",
    "logsource:",
    "  category: process_creation",
    "",                    // internal blank inside the rule
    "detection:",
    "  selection:",
    "    Image|endswith: '\\x.exe'",
    "  condition: selection",
    "level: high",
    "",
    "Plain prose ends the block here.",
  ].join("\n");
  const rules = transcribeRules(doc);
  assert.equal(rules.length, 1);
  assert.match(rules[0].text, /detection:/);
  assert.match(rules[0].text, /level: high/);
  assert.ok(!rules[0].text.includes("Plain prose"));
});

test("YARA: an UNBALANCED brace inside a quoted string does not truncate capture", () => {
  const src = [
    "```",
    "rule Str_Brace {",
    '  strings: $a = "open{brace only"',
    "  condition: $a",
    "}",
    "```",
  ].join("\n");
  const rules = transcribeRules(src);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].kind, "yara");
  assert.ok(rules[0].text.trim().endsWith("}")); // captured through the real closing brace
  assert.match(rules[0].text, /condition: \$a/);
});

test("de-nest by RANGE: two distinct rules are kept even if one text is a substring of the other", () => {
  // A short snort line whose exact text also appears verbatim inside a sigma
  // description. They are at different, non-nested offsets -> both survive.
  const snort = 'alert tcp any any -> any 80 (msg:"x"; sid:9; rev:1;)';
  const doc = [
    snort,
    "",
    "title: Rule quoting the snort",
    "description: " + snort,
    "logsource:",
    "  category: firewall",
    "detection:",
    "  selection:",
    "    dst: 1",
    "  condition: selection",
  ].join("\n");
  const rules = transcribeRules(doc);
  const kinds = rules.map((r) => r.kind).sort();
  assert.ok(kinds.includes("snort"), "snort rule preserved");
  assert.ok(kinds.includes("sigma"), "sigma rule preserved");
});

test("global/private YARA modifiers are part of the rule head", () => {
  assert.equal(classifyRule("global private rule R { condition: true }"), "yara");
  const src = "```\nglobal rule G {\n  condition: true\n}\n```";
  const rules = transcribeRules(src);
  assert.equal(rules.length, 1);
  assert.match(rules[0].text, /global rule G/);
});

// Regression for the real-world shapes validated live against SigmaHQ +
// signature-base (see PR #1 issue #2). Uses SMALL authored rules with the same
// STRUCTURE (not the third-party licensed text): a full-bodied unfenced Sigma
// with related:/falsepositives:/tags:, and a fenced multi-rule YARA with an
// import prelude, a comment, and hex/string braces.
test("full-body unfenced Sigma (related/falsepositives/tags) is captured whole", () => {
  const doc = [
    "Detection content:",
    "",
    "title: Suspicious Download Via Certutil",
    "id: 19b08b1c-861d-4e75-a1ef-ea0c1baf202b",
    "status: test",
    "related:",
    "    - id: 13e6fe51-d478-4c7e-b0f2-6da9b400a829",
    "      type: similar",
    "logsource:",
    "    category: process_creation",
    "    product: windows",
    "detection:",
    "    selection:",
    "        Image|endswith: '\\certutil.exe'",
    "        CommandLine|contains: 'urlcache'",
    "    condition: selection",
    "falsepositives:",
    "    - Legitimate administrative use",
    "level: medium",
    "tags:",
    "    - attack.command-and-control",
    "",
    "Prose resumes after the rule.",
  ].join("\n");
  const rules = transcribeRules(doc);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].kind, "sigma");
  assert.match(rules[0].text, /title: Suspicious Download Via Certutil/);
  assert.match(rules[0].text, /tags:/); // captured through the LAST key, not truncated
  assert.match(rules[0].text, /attack\.command-and-control/);
  assert.ok(!rules[0].text.includes("Prose resumes")); // stops at prose
});

test("fenced multi-rule YARA with import prelude + comment + hex/string braces", () => {
  const doc = [
    "Appendix:",
    "```",
    'import "pe"',
    "",
    "/* first family */",
    "rule Fam_A : APT {",
    "  strings:",
    "    $h = { 4d 5a 90 00 }",
    '    $s = "cred{dump}"',
    "  condition:",
    "    $h at 0 and $s",
    "}",
    "",
    "rule Fam_B {",
    "  condition:",
    "    pe.number_of_sections > 2",
    "}",
    "```",
  ].join("\n");
  const rules = transcribeRules(doc);
  assert.equal(rules.length, 1); // the whole fenced appendix, one block
  assert.equal(rules[0].kind, "yara");
  assert.match(rules[0].text, /import "pe"/); // prelude preserved (fenced path)
  assert.match(rules[0].text, /rule Fam_A/);
  assert.match(rules[0].text, /rule Fam_B/);
  assert.ok(rules[0].text.trimEnd().endsWith("}"));
});
