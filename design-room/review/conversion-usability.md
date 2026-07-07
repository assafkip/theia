# Floor — conversion-usability (interaction cost)

- **cited (Krug, self-evidence):** the BYOK key field is the highest-friction moment
  (a security practitioner pasting an API key into a web app). It must be self-evidently
  safe: "stays in your browser, never sent to us" has to be adjacent to the field and
  believable, not buried. Current MVP does say it (`em` note) — keep and elevate.
- **cited (Fitts):** the drop-target is the primary action; it must be a large, obvious
  target (a real dropzone, not just a "Choose PDF" button). MVP uses a small button.
  Gap: enlarge to a drop area for the first screen.
- **cited (Hick):** model choice (Opus vs Haiku) is a secondary decision — keep it out
  of the primary path so it doesn't compete with the drop. MVP puts it inline next to
  the file button (acceptable; ensure visual subordination).
- **cited (Nielsen — visibility of system status):** the DURING state must show real
  progress (Reading PDF → Extracting → Grounding). MVP has a text status line; the
  design should make grounding legible as a step, since grounding IS the value.
