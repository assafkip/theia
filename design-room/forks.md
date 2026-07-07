# Forks -- open choices the founder resolves

Phase 3 assembles every open design choice here as a forced-choice. Claude does
NOT pick. The founder resolves each; the pick is appended to founders-brief.md.

## Concepts

Four divergent IDEAS for the page + tool (not restyles of one idea). The founder
picks one, or a blend. Each carries a trailing source (grounded, not invented).

- Concept 1 — The Ledger (subtraction IS the subject): the extract reads as a running intel ledger where grounded facts are entered in the warm accent and dropped facts are struck-through in dim and TALLIED into a hero "N dropped" number; type-led authority hero in the Maltego lineage, one warm accent reserved for kept facts; the dropped-count is the Von Restorff moment. source: grounding/design-decisions.json#hero_subject
- Concept 2 — The Receipt (provenance IS the subject): every extracted fact is a card physically tethered by a drawn connector to the verbatim source-span that proves it, the tether glowing in the warm accent (the colored-focal-shadow steal); the made-for-this-page element is the fact-to-quote connector; bespoke, receipts-first. source: grounding/steal-manifest.json#colored-focal-shadow
- Concept 3 — The Grounding Console (the ACT IS the subject): a near-black operator console where extracted claims stream in and each visibly SNAPS to its source-span when grounded or DISSOLVES when it cannot be proven; character/subject-led in the Kali lineage, motion as protagonist in the DURING state, the mechanic explained in one animation. source: grounding/design-decisions.json#art_direction_approach
- Concept 4 — The Dossier (density IS the aesthetic): the extract as a precision intel spec-sheet, Tufte-dense with tabular mono numerals, 1px separators instead of cards, and a persistent "dropped" column that never lets you forget what was thrown away; analyst-calm navy, type-led, dashboard-mode discipline. source: grounding/tokens.md#field

## Open forks (the founder resolves; each becomes a decisions.md entry)

- [ ] FORK A — Field tone: near-black terminal `#010409` (Kali, hacker-native) vs navy analyst-calm `#303849` (Maltego, enterprise).
  - Evidence: Kali reads red-team/practitioner; Maltego reads analyst/enterprise. Buyer is both. source: grounding/tokens.md#field
- [ ] FORK B — Warm accent hex: amber `#ffb30f` (Maltego) vs orange `#fea44c` (Kali).
  - Evidence: both are the reserved "one warm hit." Amber = sharper/alert; orange = warmer/softer. source: grounding/tokens.md#warm-accent
- [ ] FORK C — Hero motion: typewriter word-cycle (Maltego) vs motion-light hero + a live grounding animation in the DURING state (the mechanic as the motion).
  - Evidence: for a tool whose subject is the extract, motion arguably belongs in DURING, not the hero. source: grounding/tokens.md#motion
- [ ] FORK D — Source-span default in the AFTER state: inline under every fact (max trust, denser) vs collapsed behind expand/hover (cleaner scan).
  - Evidence: this buyer trusts receipts; density is the cost. source: grounding/design-decisions.json#composition
- [ ] FORK E — Positioning spine (the one-sentence retell): "it drops what it can't prove" (subtraction) vs "every fact carries the sentence that proves it" (provenance) vs "threat PDF in, grounded intel out" (transform).
  - Evidence: spine decides hero copy + which concept fits. source: founders-brief.md#tests
- [ ] FORK F — Display face: buy/host a bespoke grotesk (Maltego N27 lineage, one made element) vs a free open grotesk (Kali Noto lineage, zero license).
  - Evidence: bespoke face closes the LEAD's bespoke gap cheaply; free face keeps it lean. source: grounding/tokens.md#type

## Braintrust gaps (Phase 3 — independent critic passes, evidence-bound, none decides)

Three independent passes raised these gaps against the assembled work. Gaps hand up;
the founder is the creative director.

- Pass 1 (Catmull braintrust — where does the idea break?): All four concepts risk the AFTER state (dense data) fighting the hero's art direction. Gap: the concept must survive the transition from a composed hero to a dense results surface without a second bold moment. Concept 4 (Dossier) resolves this by making density the whole aesthetic; Concepts 1-3 must design the hand-off. cited: universal-principles.
- Pass 2 (Barrett describe-analyze-interpret-judge): Concept 3 (Console) is the most ambitious IDEA but the highest build + motion-parity cost (must clear check_motion_reference_parity.py — the subject must visibly move, not a still). Gap: is the founder buying a motion build? If not, Concept 3 degrades to a style frame.
- Pass 3 (Lerman critical response — what does the work ask of the buyer?): The honesty spine is a cognitive load the buyer must be willing to read. Gap: no concept should HIDE the honesty to look cleaner (that betrays the spine), but they must sequence it so the first impression is not a wall of caveats. Lead with the dropped-count; put the "assumes / not deployable" labels at the point of use, not the hero. cited: have-something-to-say.
