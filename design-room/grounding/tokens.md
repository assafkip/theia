# Candidate Tokens — grounded from Maltego + Kali (Phase 2.0)

These are CANDIDATE tokens the lenses weigh and the founder's forks resolve. Every
value here was counted from real shipped CSS in the two teardowns
(`maltego-teardown.md`, `kali-teardown.md`). Nothing here is invented. Grounding is
candidate input, not a decision — layer, never replace.

## The one convergent signature (both references, independently)

Both practitioner tools run a **cool, near-monochrome technical field broken by ONE
warm accent**, and both reserve that warm accent for the single most important
action:
- Maltego: amber `#ffb30f` accent + `10px 10px #ffb30f` hard offset shadow, on navy `#303849`.  source: grounding/maltego-teardown.md#color
- Kali: warm orange CTA `#fea44c` breaking an all-blue field (`#367BF0`), on near-black `#010409`.  source: grounding/kali-teardown.md#color

This is the stealable move: **restraint everywhere, one warm hit where it counts.**
It maps directly to the product's honesty spine — a quiet, receipts-first surface
where the ONE emphatic color marks the thing that matters (the grounded fact / the
primary action), not decoration.

## Color — candidate sets (two grounded options + the shared logic)

### Field (dark, cool) — grounded range
- `#010409` near-black (Kali bg — GitHub-dark).  source: grounding/kali-teardown.md#color
- `#16171d` raised surface (Kali).  source: grounding/kali-teardown.md#color
- `#1d242a` ink/near-black most-used (Maltego, 73×).  source: grounding/maltego-teardown.md#color
- `#303849` navy canvas (Maltego hero).  source: grounding/maltego-teardown.md#color
- Trade-off: near-black (`#010409`) reads as terminal/hacker-native; navy (`#303849`)
  reads as calmer enterprise-analyst. Fork for the founder.

### Ink / text
- `#eeeeec` primary ink on dark (Kali).  source: grounding/kali-teardown.md#type
- `#e7edf2` current MVP ink (retain-candidate).  source: app/globals.css
- `#5b616c` dim (Maltego) / `#636363` dim (Kali).  source: grounding/*-teardown.md

### Warm accent (the ONE hit) — grounded range
- `#ffb30f` amber (Maltego).  source: grounding/maltego-teardown.md#color
- `#fea44c` warm orange (Kali CTA).  source: grounding/kali-teardown.md#color
- Role: primary action + the "grounded / proven" mark. Reserved, never ambient.

### Cool accent (secondary / structural)
- `#367BF0` Kali blue / `#2777ff` Kali brand blue.  source: grounding/kali-teardown.md#color
- `#467adf` Maltego link blue.  source: grounding/maltego-teardown.md#color
- `#a400a4` Kali purple (sparing).  source: grounding/kali-teardown.md#color

### Semantic
- Danger / malware: `#d0021b` / `#dc3545` (Maltego) · `#e06a5a` (MVP err).  source: grounding/maltego-teardown.md#color, app/globals.css
- Warn / "not deployable" / "assumed": `#fea44c`/`#ffb30f` warm (both refs).
- These carry the honesty labels (dropped count, "assumes", "not deployable").

## Type — candidate
- Display: **N27** (Maltego, self-hosted foundry, one weight) is bespoke but
  single-license; **Noto Sans** (Kali) is open. Fork: buy/host a display face vs a
  free grotesk.  source: grounding/maltego-teardown.md#type, grounding/kali-teardown.md#type
- Both heroes use a **light-weight, tight-tracked** headline (Maltego H1 = weight
  300 / −2px / 78px; Kali H1 = weight 400 / 35px). Shared decision: **authority via
  restraint, not shouting weight.**  source: grounding/*-teardown.md#type
- Body: Roboto (Maltego) / Noto Sans (Kali) — both neutral grotesks. Candidate:
  keep a neutral grotesk for body.
- Mono: Roboto Mono (Maltego) / system mono (Kali). Mono is load-bearing for THIS
  product (IOCs, rules, source spans). Retain a real mono.  source: app/globals.css

### Type scale (grounded union, px)
`12, 13, 14, 16, 18, 20, 24, 28, 32, 38, 44, 53, 78` (Maltego reaches 78; Kali tops
~56). source: grounding/maltego-teardown.md#type, grounding/kali-teardown.md#type

## Spacing / radius / shadow
- Radius: tight. Kali base `6px`; Maltego `4/8/12`. Both avoid pill-soft UI except
  chips. Candidate base radius `6px`, chips `999`.  source: grounding/*-teardown.md
- Signature shadow = **colored, not gray**: Maltego hard-offset amber `10px 10px #ffb30f`
  (no blur); Kali dragon glow `drop-shadow(20px 20px 20px #153f86)`. Steal: a colored
  accent shadow on the ONE focal element, not gray drop-shadows everywhere.  source: grounding/*-teardown.md#shadow

## Motion (candidate — a fork, not decided)
- Maltego: typewriter word-cycle on the hero headline (jQuery typed-words).  source: grounding/maltego-teardown.md#motion
- Kali: mostly static; a CSS bounce-arrow + CTA press-squish.  source: grounding/kali-teardown.md#motion
- For a tool whose subject is the extract itself, motion should serve the DURING
  state (grounding in progress) more than the hero. Fork: hero typewriter vs a
  motion-light hero + a live grounding animation.
