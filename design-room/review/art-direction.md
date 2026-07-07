# LEAD lens — art-direction (Phase 2: the BAR)

Runs FIRST. Reads `grounding/design-decisions.json` + both teardowns through the
art-direction canon and sets the ceiling the build must reach. Cited gaps + forks
only — never a verdict, never a self-resolved fork.

## L1 — CRAFT (the bar the references set)

- **`figure-ground` — is there a subject?** Both references have a clear figure:
  Kali = the glowing dragon mascot (character); Maltego = an animated amber typed
  word as the H1 focal (type). BAR: the build must have a figure the eye locks onto.
  The current MVP has **none** — it is evenly-weighted dark UI chrome on one flat
  plane (Koffka: no figure = nothing to look at). This is the primary gap to close.
  cited: `figure-ground`.

- **`universal-principles` — focal point + hierarchy?** Both references run a single
  off-center/centered focal point over a *trust-carrier* (Maltego: H1 over a scrolling
  client-logo carousel; Kali: dragon+headline over a 100vh banner). BAR: one focal
  point, then a deliberate hierarchy — not an equal-weight stack of cards (which is
  exactly what the MVP's `.block` list is). cited: `universal-principles`.

- **`bespoke-vs-default` — made or assembled?** Kali = bespoke (custom mascot, owned
  glow). Maltego = mixed (bespoke N27 face + owned amber shadow, on a jQuery-CMS
  chassis). BAR: at least **mixed**, ideally **bespoke** — one made-for-this-page
  element. MVP = **default** (system-ui, untouched dark kit). Gap. cited:
  `bespoke-vs-default`.

## L2 — CONCEPT (the idea)

- **`the-big-idea`** The references each own ONE idea (Kali: the dragon = the
  practitioner's arsenal; Maltego: "links you'd never find" investigation). For THIS
  product the ONE idea is not "AI reads your PDF" — it is **"every fact carries the
  sentence that proves it, and the ones that can't are dropped and counted."** The
  design must make PROVENANCE the subject, not the AI. cited: `the-big-idea`.

- **`have-something-to-say` — point of view?** The point of view the competitors
  don't have: **the tool tells you what it threw away.** Most "AI intel" tools hide
  their misses; this one counts them out loud. That belief must be visible in the
  art direction (the dropped-count is a first-class element, not fine print), or the
  craft just decorates an empty box. cited: `have-something-to-say`.

- **`concept-as-sketch`** REQUIRES ≥3 divergent concepts as forks before any build.
  Enforced in Phase 2.7 (`forks.md ## Concepts`). The tool may not pick. cited:
  `concept-as-sketch`.

## L3 — TRUTH (refused — handed to the founder)

- **`reflective-design` / `quality-without-a-name`** Whether the chosen subject is
  ownable by KTLYST and resonant with a burned threat-intel analyst is NOT scored
  here. The candidate subjects (the receipt/source-span made visible; a mascot; a
  type-led authority hero) are surfaced as concept forks. The founder's eye + a real
  practitioner decide. REFUSED.

## The bar, stated (what the build must reach)

1. A figure (hero subject) — close the MVP's no-subject gap.
2. One focal point + real hierarchy — not an equal-weight card stack.
3. At least mixed, ideally bespoke — one made-for-this-page element.
4. Provenance (not the AI) is the idea; the dropped-count is a first-class element.
5. One warm accent on a cool field, reserved for the focal/grounded element
   (the convergent grounded signature).

## Forks this lens hands up (the founder resolves in forks.md)
- FORK A: field tone — near-black terminal (Kali) vs navy analyst-calm (Maltego).
- FORK B: art-direction approach / subject — type-led authority (Maltego) vs
  character/subject-led (Kali) vs a product-native subject (the receipt made visible).
- FORK C: warm accent hex — amber `#ffb30f` vs orange `#fea44c`.
- FORK D: hero motion — typewriter (Maltego) vs motion-light hero + live grounding
  animation in the DURING state.
