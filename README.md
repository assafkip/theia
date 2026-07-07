# KTLYST Extract

**Advisory in, hunt-ready IOCs out — in seconds, not an afternoon.**

Drop a threat-advisory PDF. Get every actionable artifact pulled out and linked to
the exact line that proves it: typed IOCs (IP / domain / URL / hash / CVE / email),
named threats (actors / tools / malware), the ATT&CK technique IDs the vendor
printed, the vendor's own Sigma/YARA/Snort rules, and single-field Sigma sweep
snippets. Every item is a verbatim string from the document, shown with its source
span.

**100% deterministic, 100% client-side.** No LLM, no API key, no server, no
network — extraction runs entirely in your browser. Nothing leaves your machine.
Free, no signup. (PRD-003 removed the LLM extraction pass; see below.)

**Fact layer, not opinion layer.** This tool asserts what a report *contains* —
never what it *means*, whether it is malicious, or how to detect it. That
interpretation changes company to company and is the full KTLYST product's wedge
(its per-customer LLM fleet). This is the free front-door to it.

## Detection-rule support (PRD-002)

Two deterministic add-ons, both keeping the "LLM proposes, deterministic layer is
truth" contract. Neither authors detection logic.

- **Rules found in the report** — if the advisory ships its own Sigma/YARA/Snort
  rules, they are pulled **verbatim** (byte-for-byte), grounded against the PDF,
  and shown with copy buttons. Zero authoring; labeled as the vendor's own text.
- **IOC sweep snippets** — each grounded IOC is slotted into a fixed
  vendor-neutral Sigma shape via a fixed `field_type → logsource/field/match`
  table (`app/lib/sigmaTemplate.mjs`). One field, one value, one condition.

**What these are NOT (honesty contract, enforced in the UI copy):**

- IOC sweep snippets are **hunt starting points, not deployable detections** and
  not detection engineering. Each card shows its *assumed* logsource/field so the
  guess is visible; tune it and false positives before use.
- No behavioral/correlation logic (multi-field, sequence, threshold, timeframe).
  That is the full product's wedge, deliberately out of scope here.
- **Provenance, not maliciousness.** The grounding gate proves a value is *in the
  source*, not that it is *malicious*. If the model tags a benign in-source domain
  (a footer, a reference URL) as an observable, a sweep snippet will be generated
  for it. A human reviews each card; the source span is shown for exactly this
  reason. (Tracked: issue #3.)

## The capability: extract only what's provably there

Every emitted item satisfies a **byte-for-byte provenance guarantee** (PRD-003
§2.0): `documentText.slice(start, end) === source_span`, non-empty. Nothing is
inferred, summarized, scored, or invented — the extractors only surface strings
that are literally in the document.

- **IOCs** (`iocExtract.mjs`) — defang-aware regex (`hxxps://evil[.]com` →
  `https://evil.com`). TLD allowlist + filename-extension exclusion + octet/length
  validation cut false positives.
- **Named threats** (`entities.mjs`) — *deterministic curated matching* against a
  vendored gazetteer (MITRE ATT&CK Groups + Software, Malpedia families). A match
  means the name is **present**, not that the actor is attributed.
- **Printed ATT&CK IDs** (`attackIds.mjs`) — only the technique IDs the vendor
  wrote down, asserted as ATT&CK only when present in the snapshot.
- **Vendor rules** (`ruleTranscribe.mjs`) + **IOC sweep snippets**
  (`sigmaTemplate.mjs`) — unchanged from PRD-002 (one surgical refang-aware fix).

`grounding.mjs` (the 1:1 v007 port) is retained as a secondary sanity gate under
the stronger slice-equality guarantee.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000  — drop a PDF, read the extract
```

No key. No config. Extraction is client-side.

## Verify (no key, no network)

```bash
npm test             # 77 tests: grounding + sigmaTemplate + ruleTranscribe +
                     # iocExtract + entities + attackIds + extractLoop (node --test)
npm run harness      # deterministic extraction over the 4 advisory PDFs + a 3-kind
                     # rule fixture; asserts the §2.0 slice invariant on real bytes
npm run gazetteer    # refresh app/lib/gazetteer.json from MITRE ATT&CK + Malpedia
```

CI (`.github/workflows/ci.yml`) runs `npm test` + `npm run build` on every push
and PR (Node 20 + 22).

## Roadmap

- **Phase 1 (done):** BYOK LLM extract + deterministic grounding + upload UI.
- **Phase 2 (done, PRD-003):** removed the LLM — fully deterministic, client-side,
  free. Fact layer split from the full product's opinion layer.
- **Later:** OCR for scanned PDFs, IPv6, STIX/MISP export, share links.

## Architecture

```
PDF ──pdfToText──▶ text ──▶ [ iocExtract | entities | attackIds |
 (pdfjs, browser)             ruleTranscribe | sigmaTemplate ] ──▶ UI
                            (deterministic; every item carries a verbatim span)
```

- `app/lib/iocExtract.mjs` — defang-aware typed IOC regex + refang/defang.
- `app/lib/entities.mjs` — gazetteer entity matching (curated, FP-guarded).
- `app/lib/attackIds.mjs` — printed ATT&CK technique IDs, snapshot-gated.
- `app/lib/grounding.mjs` — deterministic v007 port (secondary sanity gate).
- `app/lib/sigmaTemplate.mjs` — atomic Sigma templater (grounded IOC → fixed shape).
- `app/lib/ruleTranscribe.mjs` — verbatim Sigma/YARA/Snort transcription.
- `app/lib/extractLoop.js` — the deterministic composition; lazy-loads the gazetteer.
- `app/lib/{gazetteer,tlds,entity-stoplist}.json` — vendored data (built by
  `scripts/build-gazetteer.mjs`).
- `app/lib/pdfText.mjs` — PDF → text (pdfjs, browser).
- `app/page.jsx` — the one-page UI.

PRDs, Codex review dispositions, and verification live in `docs/prd/`
(`PRD-002-detection-rules.md`, `PRD-003-deterministic-pivot.md`).
