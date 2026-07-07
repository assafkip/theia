# Founder's Brief -- Accumulated Inputs (Canonical)

Every lens reads this file first. These are the founder's actual words and reactions
across the whole design process. They are LAYERS, not replacements. All are
simultaneously true. New input is appended, never overwritten.

---

## Product Description

KTLYST Extract is a BYOK (bring-your-own-key) web tool. A practitioner drops a
threat-advisory PDF and gets back structured, source-grounded intel:

- Executive summary (bullets)
- Threat actors
- TTPs / behavioral patterns, each tagged with ATT&CK IDs + a detection idea
- Tooling / malware
- IOCs / observables, each with the **verbatim source span that proves it**
- **Rules transcribed** verbatim from the advisory itself (Sigma / YARA / Snort the
  vendor already shipped in the PDF) — pulled byte-for-byte, labeled "not KTLYST output"
- **Atomic "IOC sweep" Sigma** templated from grounded IOCs — single-field sweeps,
  explicitly labeled hunt STARTING POINTS, NOT deployable detections, NOT detection
  engineering, with the assumed logsource/field shown as a guess to tune

**The core mechanic (the whole point):** the LLM proposes; a DETERMINISTIC grounding
layer (`app/lib/grounding.mjs`, a 1:1 JS port of the big product's v007 gate —
whitespace/hyphen/typography normalize + case-sensitive substring containment)
DECIDES what is real. Every fact must trace to verbatim text in the source PDF.
**Ungrounded claims are DROPPED, not shipped.** The UI surfaces a live count:
"N claimed fact(s) dropped — not verbatim in the source. This is the grounding gate
working."

It is the front half of the full KTLYST pipeline only (ingestion + IR/ttp_story),
stopping before the 11 specialists / council / gates / packaging.

## What it IS NOT (hard positioning constraint, founder-owned)

- NOT a detection engineering tool. NOT a SIEM/SOAR/XDR. NOT a deployable-detection
  generator. The atomic Sigma is a HUNT STARTING POINT, never a shipped rule.
- NOT an intelligence tool that asserts maliciousness. It asserts PROVENANCE:
  "this fact is in the document, here is the exact sentence." "Provenance, not
  maliciousness."
- NOT an overclaiming AI product. Honesty / anti-overclaim is a FIRST-CLASS design
  constraint, not a footnote. The dropped-facts count, "provenance not
  maliciousness," and "starting point not deployable" must be designed IN, visible,
  not hidden in fine print.

## Founder Identity & Perspective

Founder/CEO, KTLYST Labs. 12+ years in threat intelligence (LinkedIn, Google, Meta,
ElevenLabs). Builds for the practitioner he used to be. The trust story is personal:
the reason facts get dropped is he has watched intel tools overclaim and burn analyst
trust. Determinism-is-truth is the moral spine of the product, not a feature.

## Accumulated Design Constraints

### Visual
Reference sites the founder chose to ground the design (the ONLY source of the look):
- **https://www.maltego.com/** — OSINT / link-analysis investigation platform
- **https://www.kali.org/** — the penetration-testing Linux distribution

Both are practitioner-native security tooling. The buyer lives in these tools. The
current MVP is a bare dark functional shell (IBM-Plex-ish, single teal #0e6e63,
one page) — design was deliberately deferred until now. NOT a constraint to keep;
it is the thing being replaced.

### Tone
Speaks to a security practitioner as a peer. Precise, technical, unhyped. The tool
tells you what it DROPPED and why. It never says "trust me" — it shows the source
span. Confidence through restraint and receipts, not through adjectives.

### Product Positioning
Grounded EXTRACTION where the deterministic layer is the source of truth. The wedge
vs every other "AI reads your PDF" tool: this one drops what it can't prove and
counts it out loud.

### Target Audience Psychology
Detection engineers, threat-intel analysts, SOC / IR practitioners, red teamers.
They are burned by tools that hallucinate confidently. What makes them leave: a
product that feels like a marketing-grade "AI magic" box with no receipts. What
earns them: verbatim source spans, an honest dropped-count, and clear labels on
what is and isn't deployable. They trust tools that admit limits.

## What Has Failed Before
The MVP was never designed — it was functional-only by directive (mirror the
interview-coach's capability, not its look). So there is no failed design yet; there
is an undesigned tool. The risk to avoid: dressing it up into an overclaiming
"AI intel platform" that betrays the honesty spine.

## Tests

### The One-Sentence Test
"Drop a threat-advisory PDF, get back structured intel where every fact is traced to
the sentence that proves it — and the ones that can't be proven are dropped and
counted."

### The 8-Second Test
- What does this do? Turns a threat PDF into structured, source-proven intel.
- Is there a demo? The before/during/after states ARE the demo (drop → grounding → extract).
- Are these people credible? The receipts (verbatim spans + dropped count) are the credibility.

---

## Layer: reference sites resolved (2026-07-04)
- [FORK-RESOLVED founder] Grounding sources = maltego.com + kali.org. Founder
  replaced the proposed candidate list (Linear/Anthropic/GreyNoise/Vercel) entirely.
  Rationale: practitioner-native security tooling; the buyer already lives there.
