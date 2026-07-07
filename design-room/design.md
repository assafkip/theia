# KTLYST Extract -- Design Spec (design.md)

GROUNDED MODE: every token carries a `source:` (grounding/<file>#<anchor> or
fork:<id>). No token is invented.

## Identity
- Name-first concept: **The Dossier, lightened** — the extract as a precision intel
  spec-sheet, but on a calm paper field instead of a dark console. Density is the
  aesthetic; readability is the directive. source: forks.md#concepts (Concept 4) +
  fork:founder-light-directive-2026-07-07
- One-sentence test: "Threat PDF in, grounded intel out — every fact linked to the
  line that proves it." source: fork:E-transform

## Resolved forks (founder, 2026-07-07)
- **Tone/field:** LIGHT — overrides FORK A (dark near-black vs navy). Founder
  directive: "light site, easily readable, not overly stylized."
  source: fork:founder-light-directive-2026-07-07
- **FORK B — warm accent:** amber `#ffb30f`. source: fork:B-amber
- **FORK C — hero motion:** motion-light, no typewriter. source: fork:founder-light-directive
- **FORK D — source spans:** collapsed behind a per-row toggle. source: fork:D-collapsed
- **FORK E — positioning spine:** Transform — "Threat PDF in, grounded intel out."
  source: fork:E-transform
- **FORK F — display face:** free system grotesk, zero license. source: fork:founder-light-directive

## Tokens
### Color (light field)
- background: `#fbfbf9`  soft paper (not pure white)  source: fork:founder-light-directive (light re-key of grounding/tokens.md#field)
- panel: `#ffffff`  raised surface  source: fork:founder-light-directive
- line: `#e6e4de`  1px separators (Dossier lean)  source: grounding/tokens.md (radius/1px), re-keyed light
- ink: `#1b1e22`  primary text  source: grounding/tokens.md#ink (dark ink, used as text on light)
- dim: `#6b7280`  secondary text  source: grounding/tokens.md#ink (dim)
- accent (the ONE warm hit): `#ffb30f` amber — grounded facts + primary action ONLY  source: grounding/tokens.md#warm-accent, fork:B-amber
- accent-ink: `#8a5a00`  amber-dark, for amber-on-white text legibility  source: derived for WCAG contrast on light field
- danger/malware: `#c0392b`  source: grounding/tokens.md#semantic (re-keyed for light)
- mono: `ui-monospace, SFMono-Regular, Menlo, monospace`  load-bearing (IOCs/rules/spans)  source: grounding/tokens.md#type

### Type
- Display/body: system grotesk stack, light-weight tight-tracked H1 (authority via
  restraint, not weight).  source: grounding/tokens.md#type (shared Maltego+Kali decision)
- Scale: `12, 13, 14, 16, 20, 28, 40` — capped well below Maltego's 78 (not stylized).  source: grounding/tokens.md#type-scale (lower subset)
- Radius: `6px` base, chips `999`.  source: grounding/tokens.md#spacing

## Build palette (chosen)
- No framework, hand-written CSS in `app/globals.css` (matches existing app; lean).

## Rationale
- Why these tokens: the ONE convergent signature from both reference tools —
  restraint everywhere, one warm hit where it counts — is kept and re-keyed onto a
  light field. Amber marks the grounded fact and the primary action, nothing else.
  Density (1px rules, mono numerals, per-fact receipts) carries the analyst-calm
  authority; the light field carries the readability the founder asked for.
- What this deliberately is NOT: not a dark hacker console, not a stylized
  marketing hero, not an overclaiming "AI platform." No gradient text, no emoji
  icons, no ambient color. The honesty labels (collapsed source spans,
  "assumes / not deployable") are designed in at the point of use, not hidden.
