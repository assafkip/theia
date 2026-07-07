# Floor — technical-accuracy (grounded fact-check)

Every technical claim the page makes must match the real product (app/lib + memory).

- **grounded MATCH:** "key stays in your browser, never sent to us" — true; BYOK,
  sessionStorage only (app/page.jsx KEY_STORE). Safe to feature.
- **grounded MATCH:** "fabricated facts are dropped" — true; grounding.mjs is the
  v007 port, drops ungrounded (`dropped_ungrounded`). The dropped-count is real data.
- **grounded MATCH:** source spans are real (`observables[].source_span`,
  `unbound_iocs[].source_span`) — the receipt UI has real data to render.
- **grounded MATCH:** transcribed rules are verbatim vendor rules (`transcribed_rules`,
  labeled "not KTLYST output"); atomic Sigma carries `category/field/match` +
  `source_span` and the "assumes / not deployable" label. The design MUST preserve
  these labels — they are load-bearing honesty, not decoration.
- **grounded CONSTRAINT:** do NOT show ATT&CK/technique claims as authoritative — the
  MVP tags `mitre_attack_ids` from the LLM; keep them presented as extracted-from-source,
  not as a KTLYST assertion. No badge that implies a validated mapping.
- **grounded CONSTRAINT:** scanned/image-only PDFs are unsupported (no OCR in MVP).
  The BEFORE/DURING states must handle that failure honestly (real error copy exists).
