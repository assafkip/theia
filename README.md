# KTLYST Extract

Drop a threat-advisory PDF. Get structured, source-grounded intelligence back:
executive summary, actors, TTPs (ATT&CK), tooling/malware, and IOCs — each fact
linked to the verbatim text that proves it. Facts the model cannot ground in the
document are **dropped**, not shipped.

This is a sibling to the full KTLYST product, not a change to it. The enterprise
pipeline turns one advisory into per-team deliverables; this turns one advisory
into a clean structured extract. Fast, cheap, one page.

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

## Verify the grounding (no key, no network)

```bash
npm test             # node --test app/lib/grounding.test.mjs
```

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
- `app/lib/extractLoop.js` — the loop: extract → parse → ground.
- `app/lib/pdfText.mjs` — PDF → text (pdfjs, browser).
- `app/page.jsx` — the one-page UI.
