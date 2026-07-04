# KTLYST Extract

Drop a threat-advisory PDF. Get structured, source-grounded intelligence back:
executive summary, actors, TTPs (ATT&CK), tooling/malware, and IOCs — each fact
linked to the verbatim text that proves it. Facts the model cannot ground in the
document are **dropped**, not shipped.

This is a sibling to the full KTLYST product, not a change to it. The enterprise
pipeline turns one advisory into per-team deliverables; this turns one advisory
into a clean structured extract. Fast, cheap, one page.

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

## The capability (mirrored from the interview-coach tool)

Same shape as the coach: **the LLM proposes, a deterministic layer is the source
of truth.**

| Coach | KTLYST Extract |
|---|---|
| `scorer.js` deterministically scores an answer | `grounding.mjs` deterministically grounds every fact |
| The model never eyeballs the score | The model never decides what's "real" |
| BYOK — key stays in the browser | BYOK — key stays in the browser |

`grounding.mjs` is a 1:1 port of KTLYST's v007 gate (case-sensitive substring
containment after whitespace / PDF-line-wrap / typography normalization). If the
model returns a fact whose `source_span` is not verbatim in the PDF, it is
dropped.

## Run it (BYOK)

```bash
npm install
npm run dev          # http://localhost:3000
```

Paste your `sk-ant-…` key (stays in your browser, never sent to our server), drop
a PDF, read the extract.

## Verify (no key, no network)

```bash
npm test             # grounding + sigmaTemplate + ruleTranscribe (node --test)
npm run harness      # offline sweep of the advisory PDFs + a 3-kind rule fixture
```

CI (`.github/workflows/ci.yml`) runs `npm test` + `npm run build` on every push
and PR (Node 20 + 22). The BYOK LLM path is exercised out-of-band by
`node scripts/smoke-live.mjs` (spends real tokens; needs a key).

## Roadmap

- **Phase 1 (done):** BYOK extract loop + deterministic grounding + upload UI.
- **Phase 2:** hosted key + Supabase auth + Stripe paywall + Upstash rate limit +
  Turnstile + PostHog — the coach's monetization stack.
- **Later:** OCR for scanned PDFs, share links, saved history.

## Architecture

```
PDF ──pdfToText──▶ text ──callMessage──▶ LLM JSON ──parseJson──▶ groundExtraction ──▶ UI
 (pdfjs, browser)          (BYOK, browser)                        (v007 port = truth)
```

- `app/lib/grounding.mjs` — deterministic v007 port (ground truth).
- `app/lib/extractPrompt.mjs` — ported ttp_story extraction prompt.
- `app/lib/anthropic.js` — BYOK browser client (key never hits our server).
- `app/lib/extractLoop.js` — the loop: extract → parse → ground → atomic + transcribe.
- `app/lib/sigmaTemplate.mjs` — atomic Sigma templater (grounded IOC → fixed shape).
- `app/lib/ruleTranscribe.mjs` — verbatim Sigma/YARA/Snort transcription + grounding.
- `app/lib/pdfText.mjs` — PDF → text (pdfjs, browser).
- `app/page.jsx` — the one-page UI.

The PRD, its Codex review dispositions, and verification live in
`docs/prd/PRD-002-detection-rules.md`.
