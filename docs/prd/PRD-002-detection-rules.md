# PRD-002 — Detection-rule support (transcribe + atomic Sigma template)

Status: reviewed (Codex adversarial review applied — see §10)
Repo: `~/projects/ktlyst-extract` (own git, Next 15, Vercel, live at https://ktlyst-extract.vercel.app)
Builds on: PRD-001 phase 1 (commit `dbf2a9d` — BYOK extract loop + deterministic v007 grounding)

## 1. Why

Phase 1 ships a source-grounded extract (exec summary, actors, TTPs, tooling/malware, IOCs). A security reader who trusts the extract next asks: *give me something I can run.* Two deterministic ways to do that without crossing into the big tool's authoring wedge:

1. **Transcribe** the detection rules the advisory already ships (Sigma/YARA/Snort in appendices). Zero authoring — pull verbatim, ground, display.
2. **Template** atomic vendor-neutral Sigma from IOCs we already grounded. A fixed field_type → logsource/field/match table slots a grounded value into a fixed rule shape. Zero detection logic invented.

Both preserve the phase-1 capability pattern: **the LLM proposes, a deterministic layer is the source of truth.** Neither feature authors detection logic.

## 2. What (scope)

### Feature 1 — Transcribe rules found in the report

- Detect rule blocks in the PDF text with a per-kind, line-based capture that returns **raw contiguous slices** (with `start`/`end` offsets into the original extracted text — NOT normalized):
  - **Fenced** blocks: ```` ``` ```` … ```` ``` ```` regions.
  - **Sigma** (unfenced): a contiguous region containing `title:` AND `detection:` AND `condition:` markers.
  - **YARA**: `rule <ident> {` … matching `}` via balanced-brace capture, requiring `condition:` inside.
  - **Snort/Suricata**: an `alert …( … sid:<n>; … )` line with balanced parens and a `sid:`.
- Pull each block **byte-for-byte** from the extracted text (the raw slice). Cap block length (e.g. 8 KB) to avoid runaway capture.
- **Ground** each block: `normalize()` both the raw slice and the PDF text (reusing `grounding.mjs`), require case-sensitive containment. This is a **secondary sanity gate**, not the transcription itself — a block that fails is rejected (not rendered). Because the slice comes directly from the extracted text, containment holds by construction; the gate catches capture bugs.
- Classify each block by `kind` (`sigma` | `yara` | `snort`).
- Dedupe by normalized-text hash; keep the FIRST raw slice for display.
- UI: a "Rules found in this report (verbatim from the vendor)" section, one card per block, `kind` badge, **copy button copies the exact raw slice**. Labeled as the vendor's own text, NOT KTLYST output. Empty section hidden if none found.
- **Honest limitation (documented):** PDF-to-text extraction often loses fences/indentation. Transcription targets fenced and clearly-delimited blocks; a rule reflowed into prose may be missed. We prefer a miss over a false positive.

### Feature 2 — Atomic Sigma from grounded IOCs (IOC sweep snippets)

The deterministic `FIELD_MAP` table (single source of truth), taxonomy-backed against SigmaHQ. Every entry names the **assumed** logsource category, field, and match modifier — shown on each rendered card so the assumption is explicit (not hidden detection judgment):

| field_type | logsource category | field | match |
|---|---|---|---|
| domain | dns_query | QueryName | exact |
| ip | network_connection | DestinationIp | exact |
| url | proxy | c-uri | contains |
| file_hash | process_creation | Hashes | contains |
| process | process_creation | Image | endswith |
| command_line | process_creation | CommandLine | contains |
| registry | registry_event | TargetObject | exact |

field_types NOT in the table (email, user_agent, oauth_scope, http_method, network_connection) produce **no** atomic rule.

- For every grounded observable/IOC whose `field_type` is mapped, emit ONE atomic vendor-neutral Sigma rule with a single selection: `<field[|match]>: "<value>"`, `condition: selection`. No multi-field, sequence, threshold, or timeframe logic.
- **Grounding gate for atomic gen (closes the empty-span hole):** a value produces a rule ONLY when ALL hold:
  1. `source_span` is non-empty,
  2. `spanGrounded(source_span, pdfText)` is true,
  3. `normalize(pattern)` is contained in `normalize(source_span)` (the value is evidenced by ITS OWN cited span, not merely present somewhere in the doc).
- Built fresh in JS as `app/lib/sigmaTemplate.mjs` (pure functions + `node --test`). No Python import.
- Dedupe by `(field_type, normalize(pattern), category, field)`; keep first `source_span`. Stable sort by `field_type`, then value, then span.
- UI: an "IOC sweep snippets (Sigma starting points)" section, one card per rule with the assumed logsource/field/match shown, a copy button, and the honesty note (§4).

## 3. Hard boundaries (do not cross)

- **NO behavioral/correlation rules.** That is the big tool's LLM+council+pySigma wedge. The moment a rule expresses detection LOGIC (multi-field, sequence, threshold, timeframe) instead of a single grounded-IOC match, STOP — out of scope. The per-type match modifier in FIELD_MAP is a FIXED part of the table, identical for every advisory — not per-rule invention.
- **NO YARA templating.** Atomic YARA is just hash rules, low value. YARA appears ONLY via Feature 1.
- **Sigma output is VENDOR-NEUTRAL only.** No KQL/Splunk/Sentinel native translation. Neutral Sigma is the correct format for a stackless tool.
- **Do not import the Python atomic emitter — it does not exist.** Build the mapping fresh.

## 4. Honesty requirements (ship-blocking)

- Atomic Sigma is an **IOC sweep** ("fire on this exact bad domain/hash/IP"), useful for a hunt, NOT sophisticated detection. Section label is "IOC sweep snippets (Sigma starting points)". Copy MUST NOT imply detection engineering.
- Each generated-rule card carries: *"Single-field IOC sweep from grounded text. Not a deployable detection. The assumed logsource/field is a guess — tune it, and false positives, for your environment before use."* The assumed logsource/field/match is shown on the card so the reader sees the assumption.
- Every generated rule value **traces to a grounded observable AND is contained in its own cited span** (§2 Feature 2 gate). Any value failing that produces no rule.
- Transcribed rules are the vendor's own text, labeled "verbatim from the report", copied as the exact raw slice, NOT presented as KTLYST output.

## 5. Architecture / files

- `app/lib/sigmaTemplate.mjs` (new) — pure functions:
  - `FIELD_MAP` — the field_type → {category, field, match} table (single source of truth).
  - `yamlScalar(v)` — render any dynamic scalar as a double-quoted, fully-escaped YAML string via `JSON.stringify` (safe for `:` `"` `\` newlines, leading `!`/`&`/`*`/`-`, `#`). Dynamic values are NEVER interpolated into YAML keys.
  - `atomicSigmaForObservable(obs, pdfText)` — returns a Sigma rule object or `null` (unmapped field_type, empty value, or grounding gate fails).
  - `renderSigmaYaml(ruleObj)` — deterministic YAML string, stable key order, all scalars via `yamlScalar`.
  - `atomicRulesFromExtraction(grounded, pdfText)` — grounded observables + unbound_iocs → deduped, stably-sorted array of `{ rule_yaml, field_type, value, source_span, category, field, match }`.
- `app/lib/ruleTranscribe.mjs` (new) — pure functions:
  - `findRuleBlocks(pdfText)` — per-kind line/brace/paren capture → `[{ kind, text, start, end }]` (raw slices).
  - `transcribeRules(pdfText)` — findRuleBlocks → ground (reuse `normalize` from `grounding.mjs`) → dedupe → `[{ kind, text }]` (raw text preserved).
- `app/lib/extractLoop.js` (edit) — after grounding, attach `atomic_rules` (from grounded set) and `transcribed_rules` (from `documentText`) to the result.
- `app/page.jsx` (edit) — two new sections + copy buttons + honesty notes. Functional UI, consistent with phase 1. No design overhaul.
- Tests (new): `app/lib/sigmaTemplate.test.mjs`, `app/lib/ruleTranscribe.test.mjs`, wired into `npm test`.
- `js-yaml` added as a **devDependency** ONLY (test-time parse gate; never shipped to the browser bundle — the app renders YAML with zero runtime dep).

Reuse `normalize` from `grounding.mjs` — do NOT fork the normalization contract. One normalizer, both consumers.

## 6. Success criteria (all must pass)

1. `node --test` green covering:
   - **each mapped field_type** produces a rule that `js-yaml` parses AND has `title`, `logsource.category` (in the taxonomy allowlist), `detection.selection.<field>`, `condition`;
   - the emitted `logsource.category`/`field` for each type equals the FIELD_MAP entry (taxonomy-allowlist assertion — catches wrong-field drift, not just parseability);
   - **empty `source_span` + fabricated pattern → NO rule** (the critical grounding-hole test);
   - an ungrounded value (span not in PDF) → NO rule;
   - a value not contained in its own span → NO rule;
   - an unmapped field_type → NO rule;
   - **adversarial IOC values** (containing `: ` `"` `\` newline `#` leading `-`/`!`/`&`/`*`, `{x: y}`, very long) render to YAML that still parses and round-trips the value;
   - dedupe + stable ordering hold;
   - a fenced Sigma/YARA/Snort block → transcribed, kind-classified, raw text preserved byte-for-byte;
   - an unfenced Sigma block (markers present) → transcribed; a block whose text is NOT verbatim in the source → rejected; prose that merely mentions `title:`/`alert` without structure → not captured.
2. `npm run build` clean.
3. Deploy to Vercel prod (`vercel deploy --prod --yes --scope assaf-kipnis-projects --cwd <abspath>`).
4. Manual: run **all 4** KTLYST advisory PDFs through a local node harness (extract text → transcribe → atomic) to exercise real advisory text; then run at least one through the live tool and confirm rules render + copy.

## 7. Non-goals / out of scope

- Correlation/behavioral/multi-field logic (big-tool wedge).
- YARA/Snort templating (transcribe-only).
- Vendor-native (KQL/Splunk/Sentinel) translation.
- pySigma/sigma-cli validation in CI (adds Python to a JS-only repo; the js-yaml parse + taxonomy-allowlist test covers correctness deterministically — Codex finding 3, deferred with rationale).
- Full YAML-parse validation of transcribed blocks in the browser (would add js-yaml to the runtime bundle; multi-marker + verbatim-grounding is the v1 bar — Codex finding 7).
- Stack config, catalogs, council, gates beyond the grounding gate. Design overhaul / monetization (phase 2, founder-gated).

## 8. Risks + mitigations

- **Rule-block false positives:** multi-marker + balanced brace/paren + verbatim grounding; blocks shown labeled so the reader judges the actual text.
- **Value injection into YAML:** all dynamic scalars via `yamlScalar` (JSON.stringify double-quote); adversarial-value test; values never in keys; control-char/newline patterns rejected before render.
- **Wrong Sigma taxonomy:** FIELD_MAP is taxonomy-backed; the allowlist assertion test fails on drift; each card shows the assumed logsource/field so the reader can correct.
- **Honesty regression:** §4 notes are ship-blocking and reviewed.
- **Empty-span grounding hole (Codex critical):** closed by the three-part atomic grounding gate + a ship-blocking test.

## 9. Codex review gate

Codex adversarial review ran on this PRD before implementation (§10) and runs per-diff before each commit (repo codex-discipline). Commit messages reference codex status.

## 10. Codex adversarial review — dispositions (pre-implementation)

12 findings (1 critical, 7 major, 4 minor). All triaged:

- **[critical] empty source_span → ungrounded rule** — must-fix. Three-part atomic grounding gate (§2 F2) + ship-blocking test (§6).
- **[major] wrong/non-neutral Sigma mappings** — must-fix. Taxonomy-backed FIELD_MAP with correct field names + match modifiers, shown on each card (§2 F2).
- **[major] parseable ≠ valid Sigma** — fold-in. js-yaml parse + taxonomy-allowlist assertion (§6). pySigma-in-CI deferred (§7, no Python).
- **[major] unsafe YAML escaping** — must-fix. `yamlScalar` via JSON.stringify; adversarial test (§5, §6).
- **[major] transcribe not byte-for-byte** — must-fix. Raw slices w/ offsets; copy raw; normalize = sanity gate only (§2 F1).
- **[major] block detection hand-wavy** — fold-in. Per-kind line/brace/paren capture + fixtures; documented miss-over-false-positive (§2 F1).
- **[major] markers false-positive** — fold-in. Multi-marker + balanced capture + grounding (§2 F1).
- **[major] field selection invents context** — resolved. Fixed table + prominent assumed-logsource label (§2 F2, §4).
- **[minor] honesty copy overstates** — fold-in. "IOC sweep snippets", per-card tune-before-deploy note (§4).
- **[minor] raw-vs-normalized display** — resolved. Copy the raw slice (§2 F1).
- **[minor] dedupe/ordering missing** — fold-in. Dedupe + stable sort (§2 F2).
- **[minor] weak manual acceptance** — fold-in. All-4-PDF local harness + synthetic fixtures + live check (§6).
