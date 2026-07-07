# PRD-003 — Deterministic pivot (remove the LLM; fact layer only)

Status: APPROVED (Codex-triaged; 14 findings dispositioned §10) — implementation in progress
Repo: `~/projects/ktlyst-extract` (own git, Next 15, Vercel, live at https://ktlyst-extract.vercel.app)
Builds on: PRD-001 (BYOK extract loop + v007 grounding) and PRD-002 (transcribe + atomic Sigma).
Supersedes: the BYOK LLM extraction pass from PRD-001. The deterministic add-ons from
PRD-002 (`ruleTranscribe.mjs`, `sigmaTemplate.mjs`) are kept unchanged and become
first-class, not add-ons.

## 1. Why

The tool's job is **provenance, not opinion.** An advisory reader needs every actionable
artifact — IOCs, named threats, the vendor's own rules — pulled out fast and grounded to
the exact line that proves it. Whether a fact "matters," how to detect it, and how
confident to be are **opinions that change company to company** — that is the full KTLYST
product's wedge, formed per-customer by its LLM fleet. It does not belong in the free
extract.

Today's build uses a single LLM pass (`ttp_story`) to propose facts, then a deterministic
gate to filter them. That pass earns its keep only on the **opinion fields** (executive
summary, behavioral narrative, detection ideas, confidence, inferred ATT&CK mapping). Every
other output is a thing literally printed in the PDF, which is deterministically extractable.

Cutting the opinion layer removes the LLM entirely. The result:

- **Fully deterministic, 100% client-side.** No API key, no server, no token cost. Nothing
  leaves the user's browser.
- **Free forever** — there is nothing to meter.
- **More auditable** — regex + a vendored gazetteer are inspectable line-by-line; an LLM is
  trust-then-verify.
- **Sharper wedge** — extract = the universal fact layer (deterministic, free); full product
  = the per-company opinion layer (LLM fleet, paid). The boundary is literally *fact vs
  opinion = deterministic vs LLM*.

### Positioning

- **Fact layer (this tool):** deterministic, free, private. Same output for every reader.
- **Opinion layer (full KTLYST product):** per-company interpretation, the LLM+council wedge.
- **Working pitch (founder-owned, easy to swap):** *"Advisory in, hunt-ready IOCs out — in
  seconds, not an afternoon."* Every observable, named threat, and vendor rule pulled and
  grounded, private in your browser, no signup. Provenance receipts are the proof underneath,
  not the headline.
- **Honesty-narrative shift:** PRD-001/002 marquee was *"N claimed facts DROPPED — the
  grounding gate working."* With no LLM, nothing is fabricated, so there is almost nothing to
  drop. Reframe around **provenance receipts over supported artifact types** — NOT
  "completeness." Honest wording (Codex F3/F9/F14): "mechanical extraction of the supported
  artifact types; every item links to the exact bytes in the source." Named-entity matching is
  **deterministic curated matching** (a versioned gazetteer + stoplist), not pure mechanical
  extraction — the curation is disclosed, not hidden. Known miss classes are published (§4.1),
  so "complete" is never claimed. The grounding gate stays as a by-construction sanity check on
  top of a stronger byte-for-byte guarantee (§2.0), not a marketing centerpiece.

### 2.0 Provenance guarantee (binding, Codex F2)

Every emitted item carries `{ start, end, source_span }` where
`documentText.slice(start, end) === source_span` **exactly** (byte-for-byte) and
`source_span.trim().length > 0`. This is a stronger guarantee than `spanGrounded` (which
normalizes whitespace/punctuation and returns true on empty). Extractors I own assert
slice-equality directly; `spanGrounded` is retained only as a secondary sanity gate. A
ship-blocking test asserts slice-equality for every extractor.

## 2. What (scope)

A new deterministic extraction path. Input: raw PDF text (`pdfText.mjs`, unchanged). Output:
five grounded artifact classes, every item carrying a verbatim `source_span` copied from the
document.

### Feature 1 — Typed IOC extraction (`app/lib/iocExtract.mjs`, new)

- Extract these `field_type`s via regex over the raw extracted text:
  `ip` (IPv4; IPv6 optional v1.1), `domain`, `url`, `file_hash` (md5/sha1/sha256), `cve`,
  `email`.
- **Defang-aware.** Recognize the standard defanged forms as they appear in advisories:
  `hxxp`/`hxxps` → `http`/`https`; `[.]` `(.)` `[dot]` `{.}` → `.`; `[@]` `[at]` → `@`;
  `[:]` → `:`. The value is matched in defanged OR clean form.
- **`source_span` is the raw slice as it appears** (defanged if the doc defanged it) so
  grounding holds by construction. A separate `value` field carries the re-fanged canonical
  form for display/copy. Provenance shows the raw span; the analyst copies the canonical.
- **False-positive controls (deterministic, documented):**
  - `domain`: require the TLD to be on the **vendored IANA TLD allowlist**
    (`app/lib/tlds.json`), PLUS a **filename-extension exclusion set** (Codex F4:
    `.zip .mov .doc .pdf .app .exe .dll .py .sh .zip` etc. that are ALSO real gTLDs). A
    single-label `name.ext` token is NOT emitted as a domain when `ext` is in the
    filename-exclusion set, UNLESS it appears inside a captured URL or as part of a
    multi-label host. `.onion` is explicitly allowed (Codex F5). Internal/private hostnames
    and AD domains are a documented v1 miss class (§4.1), not a false claim.
  - `ip`: reject octets > 255; reject a 4-group dotted number preceded by a `v`/`version`
    token (software version). Tested with negatives.
  - `file_hash`: exact hex length (32/40/64) with word boundaries; reject when part of a
    longer hex run (Codex F7). Negatives: dashed GUIDs (won't match), cert-serial-in-context,
    long hex blobs. The 32-hex/MD5 vs UUID-without-dashes ambiguity is deterministically
    irreducible — documented as a known overlap (§4.1), not silently resolved.
  - `url` supersedes `domain`: a domain that is part of a captured URL is not also emitted as
    a bare domain (dedupe by containment).
- **Defang grammar (canonical, Codex F6):** `hxxp`/`hxxps`→`http(s)`; `[.]` `(.)` `{.}`
  `[dot]` `(dot)` `{dot}` and spaced ` dot ` → `.`; `[@]` `[at]` ` at ` → `@`; `[:]` → `:`;
  case-insensitive. Adversarial tests per IOC type. Exotic forms (Unicode fullwidth dots,
  zero-width splits) are a documented miss class (§4.1).
- Each IOC: `{ field_type, value, source_span, start, end, count }` (`count` = occurrences;
  keep the FIRST span). Dedupe by `(field_type, normalize(value))`. Stable sort by
  `field_type`, then value. Slice-equality per §2.0.
- **Grounding gate (sanity, by construction):** reuse `spanGrounded`/`normalize` from
  `grounding.mjs` (do NOT fork). Because the span is a raw slice, containment holds; the gate
  catches capture bugs, mirroring `ruleTranscribe`.

### Feature 2 — Named-entity detection (`app/lib/entities.mjs`, new)

- A **vendored gazetteer** (`app/lib/gazetteer.json`) of known names with aliases, built from
  canonical public sources by a refresh script (Feature 5):
  - **actors** — MITRE ATT&CK Groups (`intrusion-set`), `name` + `aliases`.
  - **tools** — MITRE ATT&CK Software of type `tool`, `name` + `x_mitre_aliases`.
  - **malware** — MITRE ATT&CK Software of type `malware` + Malpedia families, `name`/
    `common_name` + aliases.
- Match: for each gazetteer term, find **whole-token, case-insensitive** occurrences in the
  PDF text (Unicode-aware word boundaries; a term is not matched inside a larger token).
  Resolve aliases to the canonical `name`; record the exact matched surface form as the span.
- **This is "deterministic curated matching," not pure mechanical extraction (Codex F9).**
  The gazetteer + stoplist encode curation decisions; that curation is disclosed in the UI
  ("gazetteer match") and versioned as a decision log, never presented as opinion-free
  discovery.
- **False-positive guard (the gazetteer soft spot — deterministic, documented, tested):**
  - Minimum term length ≥ 4 characters.
  - A **common-word stoplist** (`app/lib/entity-stoplist.json`) removes aliases that collide
    with English/security-common words. **Build-time collision report (Codex F8):**
    `build-gazetteer.mjs` cross-checks every alias against a common-word list and a
    security-term list, auto-adds high-risk collisions to the stoplist, and emits a report so
    curation is auditable, not ad-hoc-forever.
  - Word-boundary match only (Unicode-aware); never substring.
- Each entity: `{ kind, name (canonical), matched (surface form), spans: [{source_span,
  start, end}], count }`. **Keep up to N (=5) matched spans per canonical entity (Codex F10),
  capped for UI**, surfacing alias + kind, not just the first hit. Dedupe by `(kind, name)`.
  Stable sort by kind, then name.
- Every entity span satisfies §2.0 slice-equality (surface form is a byte-for-byte slice).

### Feature 3 — Printed ATT&CK technique IDs (`app/lib/attackIds.mjs`, new)

- Regex `\bT\d{4}(?:\.\d{3})?\b` over the raw text — capture technique IDs **the advisory
  itself printed**. This is transcription, not inference.
- **Only emit as an ATT&CK technique when the id is present in the vendored technique map
  (Codex F11).** A `T####` string not in the snapshot is a coincidental match (code line,
  table id, product SKU) — flagged `in_attack: false` and visually separated / suppressed,
  never asserted as ATT&CK. Attach the official technique name via static lookup for known
  ids (a deterministic dictionary lookup, NOT an opinion; contrast: inferring an unprinted id
  from prose — out of scope, §3). Negative tests around code/table identifiers.
- Each: `{ id, name (snapshot name or null), in_attack (bool), source_span, start, end }`.
  Dedupe by `id`; stable sort by id. Span satisfies §2.0.

### Feature 4 — Vendor's own rules (`app/lib/ruleTranscribe.mjs`, UNCHANGED)

Kept exactly as shipped in PRD-002. Verbatim Sigma/YARA/Snort pull + grounding + dedupe.
Honesty language preserved (Codex F14): "verbatim **when structurally recognized**" — NOT
"all vendor rules." Snort multi-line continuations and reflowed unfenced blocks remain a
documented miss (§4.1). No coverage claim beyond PRD-002.

### Feature 5 — Atomic Sigma sweep snippets (`app/lib/sigmaTemplate.mjs`, ONE surgical change)

Kept as shipped in PRD-002 EXCEPT one tested change forced by Codex F1 (critical):

- **Problem:** the atomic grounding gate requires `normalize(pattern)` contained in
  `normalize(source_span)`. For defanged IOCs the rule must contain the **refanged** value
  (`https://evil.com`) to be huntable, but the span is the **defanged** slice
  (`hxxps[:]//evil[.]com`) — so the gate rejects every defanged IOC. That is most real
  advisory IOCs.
- **Fix (scoped amendment to §3):** the containment check becomes refang-aware — it passes if
  `normalize(pattern)` OR `normalize(defang(pattern))` is contained in `normalize(source_span)`
  (reusing the canonical `defang` from `iocExtract.mjs`; one grammar, shared). The rendered
  Sigma value stays the canonical refanged IOC (what you actually hunt). Provenance: the card
  shows the defanged span; the deterministic refang step is auditable. New tests: a defanged
  IOC produces a sweep rule whose value is the refanged form and whose evidence is the defanged
  span; the empty-span and fabricated-value rejections from PRD-002 still hold.
- The adapter (IOC set → observable shape `{field_type, pattern: value, source_span}`) lives
  in `extractLoop.js`.

### Feature 6 — Gazetteer refresh script (`scripts/build-gazetteer.mjs`, new)

- Deterministic build tool (per founder rule: script-based, not hand-maintained). Fetches:
  - MITRE ATT&CK Enterprise STIX bundle (canonical CTI repo), filters `intrusion-set` and
    `malware`/`tool` objects → names + aliases; `attack-pattern` → technique id→name map.
  - Malpedia families endpoint → family common names + aliases.
- Emits `app/lib/gazetteer.json` (compact: names, aliases, technique map) and reports counts.
- **Vendored snapshot is the source of truth at runtime** (offline, in-browser). The script is
  run at build/refresh time only; its output is committed. If the network is unavailable at
  authoring time, a committed seed snapshot ships and the script's provenance/refresh path is
  documented — the app never fetches at runtime.
- `app/lib/tlds.json` (IANA TLD list) and `app/lib/entity-stoplist.json` are generated/seeded
  by the same script family and committed.

### Feature 7 — Loop + UI rewrite

- `app/lib/extractLoop.js` (edit) — remove LLM. New signature `runExtraction({ documentText })`
  → `{ iocs, entities: { actors, tools, malware }, attack_ids, transcribed_rules,
  atomic_rules, meta: { counts, extracted_at } }`. Pure, synchronous, no key, no network.
- `app/page.jsx` (edit) — remove the BYOK key input, model tier selector, and cost display.
  New flow: drop PDF → `pdfText` → `runExtraction` → render five sections (IOCs by type,
  named threats, printed ATT&CK IDs, vendor rules, sweep snippets), each item with its source
  span and a copy button; a "copy all IOCs" affordance. Honesty note reframed per §1.

## 3. Hard boundaries (do not cross)

- **NO LLM anywhere in the runtime path.** No API calls, no key, no network at runtime. If a
  feature needs a model, it is out of scope (it belongs to the full product).
- **NO inference.** Every emitted item must be a verbatim slice of the source. Do not infer an
  ATT&CK ID from prose; do not infer maliciousness; do not summarize; do not score confidence;
  do not author behavioral/correlation logic. Provenance, not opinion.
- **NO opinion fields.** `exec_summary`, `behavioral_patterns` narrative, `detection_idea`,
  `confidence`, inferred `mitre_attack_ids` are removed, not ported.
- **Gazetteer/TLD/stoplist are DATA, not code.** No hardcoded name lists inside `.mjs` logic;
  the logic reads the vendored JSON. Refresh is a script, not a manual edit.
- **Sigma output stays vendor-neutral, single-field** (PRD-002 boundary unchanged).
- **Do not modify** `grounding.mjs`, `ruleTranscribe.mjs`, `pdfText.mjs`. Reuse their exports;
  one normalizer, shared. **`sigmaTemplate.mjs` gets exactly ONE surgical, tested change**
  (Feature 5 / Codex F1): a refang-aware containment check. No other behavior changes; every
  existing `sigmaTemplate` test stays green.

## 4. Honesty requirements (ship-blocking)

- Each item shows its **verbatim source span**; nothing is displayed without provenance.
- IOC cards state the value is **as extracted**, defang shown alongside canonical, so the
  reader sees exactly what the document contained.
- Named-entity cards state the match is **a name-list hit** (gazetteer), not an assertion the
  actor is present/active — provenance is "this name appears in this document."
- ATT&CK ID cards state the ID was **printed by the vendor**, name is the official MITRE label
  — not an inference.
- Sweep-snippet honesty copy from PRD-002 §4 is retained verbatim (starting point, not
  deployable, assumed logsource shown).
- The reframed top-line honesty note replaces the "N dropped" marquee: extraction is
  **mechanical over the supported artifact types** (NOT "complete over the document" — Codex
  F3); the tool asserts provenance, never maliciousness, significance, or completeness.

### 4.1 Known miss classes (published in-product, Codex F3/F5/F6/F14)

The tool states, visibly, what it does NOT catch — so "complete" is never implied:

- IOCs split across PDF line-wraps or with injected spaces/zero-width chars; exotic defangs
  (Unicode fullwidth dots); hashes reflowed mid-token.
- Internal/private hostnames, AD domains, appliance-local names (public DNS + `.onion` only).
- Named actors/tools/malware absent from the vendored gazetteer snapshot (new/renamed).
- Vendor rules that survive PDF-to-text only when structurally recognized (fenced or clearly
  delimited); reflowed-into-prose rules and Snort multi-line continuations are missed.
- The 32-hex MD5 / dashless-UUID overlap is not disambiguated.

## 5. Architecture / files

New:
- `app/lib/iocExtract.mjs` — pure fns: `extractIocs(text)`, `defang(value)`, `refang(value)`.
- `app/lib/entities.mjs` — pure fns: `detectEntities(text, gazetteer)`.
- `app/lib/attackIds.mjs` — pure fns: `extractAttackIds(text, techniqueMap)`.
- `app/lib/gazetteer.json` — vendored names/aliases + technique id→name map (committed).
- `app/lib/tlds.json`, `app/lib/entity-stoplist.json` — vendored data (committed).
- `scripts/build-gazetteer.mjs` — refresh tool (build-time only).
- Tests: `app/lib/iocExtract.test.mjs`, `app/lib/entities.test.mjs`,
  `app/lib/attackIds.test.mjs` — wired into `npm test`.

Edited:
- `app/lib/extractLoop.js` — LLM removed; deterministic composition + sigmaTemplate adapter.
- `app/page.jsx` — BYOK/model/cost UI removed; five deterministic sections.
- `scripts/harness.mjs` — exercise deterministic extraction over the 4 advisory PDFs.
- `package.json` — `test` script adds the three new test files; remove `smoke-live` usage;
  add a `gazetteer` refresh script entry.
- `README.md`, `design-room/founders-brief.md` — positioning + honesty reframe.

Removed:
- `app/lib/anthropic.js`, `app/lib/extractPrompt.mjs`, `scripts/smoke-live.mjs`.

Unchanged (reused): `app/lib/grounding.mjs`, `app/lib/ruleTranscribe.mjs`,
`app/lib/sigmaTemplate.mjs`, `app/lib/pdfText.mjs`.

## 6. Success criteria (all must pass)

1. `node --test` green covering:
   - **IOCs:** each `field_type` positive (clean + defanged variants); span is byte-for-byte
     from the source; refang canonicalization; dedup + stable order; URL-contains-domain
     dedupe; negatives — octet > 255 not an ip, version string not an ip, non-TLD dotted token
     not a domain, over/under-length hex not a hash.
   - **Entities:** known actor/tool/malware and an alias each match to canonical; FP guard —
     a short alias (< 4) and a stoplisted common-word alias do NOT match; substring (name
     inside a larger token) does NOT match; span verbatim; dedup + stable order.
   - **ATT&CK IDs:** `T1566` and `T1078.004` captured with names from the snapshot; prose
     without a printed ID yields none; dedup + order; unknown id → `name: null`, still emitted.
   - Existing `grounding`, `sigmaTemplate`, `ruleTranscribe` suites stay green unchanged.
2. `npm run build` clean.
3. `npm run harness` green: deterministic extraction over all 4 advisory PDFs (unit42, openssh,
   shinyhunters, cyber_triage) yields non-empty IOCs on the IOC-bearing advisories, entities
   where names are present, and never emits an item whose span is not verbatim in that PDF.
4. **No runtime LLM/network (Codex F13, strengthened):** (a) an import-graph grep proves no
   module in the runtime path imports `anthropic.js`/`extractPrompt.mjs` and none references
   an API key; (b) a runtime test invokes `runExtraction` with `globalThis.fetch` stubbed to
   throw and asserts it still returns a full result — proving zero network at runtime;
   (c) `runExtraction` is synchronous and pure.
5. **Provenance guarantee (Codex F2):** a test asserts, for every extractor and every item,
   `documentText.slice(start,end) === source_span` and `source_span.trim()` non-empty.
6. **Bundle budget (Codex F12):** `app/lib/gazetteer.json` is lazy-loaded (dynamic import
   after PDF text extraction), not in the initial route bundle; the build reports the gzipped
   gazetteer size and it is under a stated budget (≤ 250 KB gzip). Recorded in §11.
7. Deploy to Vercel prod; `/` returns 200; a real PDF renders all five sections with copy.

## 7. Non-goals / out of scope

- Any LLM/opinion output (summary, behavioral narrative, detection idea, confidence, inferred
  ATT&CK). The full product's wedge.
- IPv6 IOCs, STIX/MISP export, share links, saved history — later.
- Runtime gazetteer fetching or auto-refresh — the snapshot is vendored; refresh is a script.
- Auth / rate limit / paywall — no token cost means no cost-gating; lead-capture gating is a
  separate GTM decision, not this PRD.
- Design overhaul — functional UI consistent with PRD-001/002; visual work is the design-room's.

## 8. Risks + mitigations

- **IOC false positives** (version strings, filenames): TLD allowlist for domains, octet/length
  validation, `v`/`version` guard for ip, URL-containment dedupe; all tested with negatives.
- **Gazetteer false positives** (short/common-word aliases): min-length ≥ 4, versioned
  common-word stoplist, whole-token boundary match; adversarial tests.
- **Gazetteer staleness:** refresh is a deterministic script against canonical sources;
  snapshot is committed and dated; freshness documented. Miss of a brand-new actor name is a
  known, acceptable v1 limit (a name not on the list is simply not tagged — no false claim).
- **Defang round-trip corruption:** span is always the raw slice (grounding by construction);
  canonical value is display-only; adversarial defang tests.
- **Positioning regression:** the "N dropped" copy is reframed, not silently deleted; honesty
  notes are ship-blocking and reviewed (§4).
- **Network unavailable at authoring:** committed seed snapshot ships; app never fetches at
  runtime; refresh path documented.

## 9. Codex review gate

Codex adversarial review runs on this PRD before implementation and per-diff before each
commit (repo codex-discipline). Every finding gets a disposition (must-fix / optional /
deferred / rejected-with-reason). Commit messages reference codex status. Dispositions recorded
in §10; verification in §11.

## 10. Codex adversarial review — dispositions (pre-implementation)

Codex `gpt-5.5` adversarial review ran on the draft PRD (session `019f3e05`). 14 findings
(1 critical, 10 major, 3 minor). Verdict: "not safe to implement as written." All triaged;
every must-fix folded into §1–§6 above.

| # | Sev | Finding | Disposition |
|---|-----|---------|-------------|
| 1 | critical | Sigma adapter breaks defanged IOCs (refanged value not in defanged span) | **must-fix.** Scope amended: one refang-aware containment change to `sigmaTemplate.mjs` (§2 F5, §3). |
| 2 | major | "grounded" ≠ "verbatim"; `spanGrounded` normalizes + empty→true | **must-fix.** §2.0 byte-for-byte slice-equality guarantee + ship-blocking test (§6.5). |
| 3 | major | "mechanical and complete" overclaims | **must-fix.** Reworded to "supported artifact types"; §4.1 known miss classes published (§1, §4). |
| 4 | major | TLD allowlist lets `.zip`/`.mov` filenames through as domains | **must-fix.** Filename-extension exclusion set + fixtures (§2 F1, §6.1). |
| 5 | major | Misses `.onion`/internal/AD hostnames | **scoped.** `.onion` added; internal/private documented as v1 miss (§2 F1, §4.1, §7). |
| 6 | major | Defang coverage incomplete | **must-fix.** Canonical defang grammar (spaced sep, `{dot}`/`(dot)`) + adversarial tests; exotic → miss class (§2 F1, §4.1). |
| 7 | major | Hash FPs (GUID/serial/hex blob) | **must-fix.** Boundary + not-part-of-longer-run + negatives; MD5/UUID overlap documented (§2 F1, §4.1). |
| 8 | major | Alias matching noisy | **must-fix.** Build-time collision report auto-stoplists high-risk aliases (§2 F2, F6). |
| 9 | major | Stoplist = judgment, claims pure determinism | **must-fix.** Relabeled "deterministic curated matching," versioned decision log, "gazetteer match" UI copy (§1, §2 F2, §4). |
| 10 | major | Dedupe-by-name hides evidence | **must-fix.** Keep up to N=5 spans per entity, surface alias+kind (§2 F2). |
| 11 | minor | ATT&CK regex matches non-technique strings | **fold-in.** Only assert ATT&CK when id in snapshot; else `in_attack:false`, suppressed; negatives (§2 F3, §6.1). |
| 12 | major | Gazetteer bundle size unbounded | **must-fix.** Size budget ≤250KB gzip, compact JSON, lazy-load after PDF parse, measured in build (§2 F6, §6.6, §11). |
| 13 | major | no-network grep too weak | **must-fix.** Import-graph check + `fetch`-throws runtime test (§6.4). |
| 14 | minor | "transcription unchanged" implies more coverage | **fold-in.** Keep PRD-002 honest wording "verbatim when structurally recognized" (§2 F4). |

Post-triage verdict: implementable. Codex re-reviews per-diff during build (§9); results in §11.

## 11. Verification (build phase)

- **§6.1 node --test:** 79/79 green (grounding 12, sigmaTemplate 16, ruleTranscribe
  18, iocExtract 19, entities 10, attackIds 8, extractLoop 6). Covers defang round-
  trips, FP negatives (octet>255, version incl. colon form, filename-TLD, over-length
  hex, dashed GUID, comma/semicolon URL lists), entity FP guard + substring + up-to-5
  spans, ATT&CK exact-hit-only assertion, and the §2.0 slice-equality invariant.
- **§6.2 npm run build:** clean (Next 15, route `/` 11.6 kB, First Load 114 kB).
- **§6.3 harness:** ALL GREEN over all 4 real advisories (unit42, openssh,
  shinyhunters, cyber_triage) — real IOCs (34/6/61/4), entities, printed ATT&CK
  (openssh 1, shinyhunters 15), **0 §2.0 slice violations**, fabricated/empty-span
  rejection holds. 3-kind rule fixture green.
- **§6.4 no-network:** `extractLoop.test.mjs` runs `runExtraction` with `fetch`
  stubbed to throw and still returns a full result; removed `anthropic.js`/
  `extractPrompt.mjs` are imported by no runtime module.
- **§6.5 provenance:** slice-equality asserted for every extractor + every real-PDF
  item (0 violations).
- **§6.6 bundle:** gazetteer (191 KB raw / 47 KB gzip) is in a separate lazy chunk
  (`476.*.js`), NOT the 114 KB route First Load — under the 250 KB gzip budget.

### Codex per-diff review (implementation) — dispositions

Codex `gpt-5.5` reviewed the implementation commit (ran live perf probes). 5 findings
(4 major, 1 minor); verdict "not safe to deploy". Triaged + fixed:

| # | Sev | Finding | Disposition |
|---|-----|---------|-------------|
| 1 | major | attackIds parent-fallback falsely asserts ATT&CK for fake sub-ids | **fixed.** `in_attack` = exact snapshot hit only; real sub-techniques are already in the snapshot. |
| 2 | major | comma/semicolon-adjacent URLs collapse into one IOC | **fixed.** `,`/`;` excluded from URL body; list test added. |
| 3 | major | spaced ` dot `/` at ` refanged but never matched by extraction | **deferred.** Intentional §4.1 miss (ReDoS + FP risk); documented, not a correctness bug. |
| 4 | major | entity match = ~6k full-text scans, multi-second stall on large reports | **fixed.** First-token doc index (sound: bounded term match ⇒ first token is a bounded doc token). 1 MB benign: 1212 ms → 11 ms. |
| 5 | minor | `version: 1.2.3.4` emits as an IP | **fixed.** Version guard allows a `:`/`.` between word and number; test added. |

Post-fix: 79/79 tests green, harness ALL GREEN, build clean. Re-review verdict basis
addressed (4 fixed, 1 deferred-with-reason).

### Deploy

_(recorded after Vercel prod deploy)_
