// PRD-003 Feature 3 — printed ATT&CK technique IDs (transcription, not inference).
//
// Capture T#### / T####.### strings the advisory ITSELF printed. Codex F11: only
// ASSERT ATT&CK when the id exists in the vendored technique map; a coincidental
// T-string (code line, table id, product SKU) is flagged in_attack:false, not
// claimed. The official technique name for a known id is a deterministic dictionary
// lookup (NOT an opinion). Inferring an unprinted id from prose is out of scope.

import { sentenceContext } from "./context.mjs";

const ATTACK_RE = /\bT\d{4}(?:\.\d{3})?\b/g;

// extractAttackIds(text, techniqueMap)
//   techniqueMap: { "T1566": "Phishing", ... } from the vendored snapshot.
// Returns [{ id, name, in_attack, source_span, start, end }] deduped by id.
export function extractAttackIds(text, techniqueMap = {}) {
  const src = String(text ?? "");
  const byId = new Map();

  ATTACK_RE.lastIndex = 0;
  let m;
  while ((m = ATTACK_RE.exec(src)) !== null) {
    const id = m[0];
    if (byId.has(id)) {
      byId.get(id).count += 1;
      continue;
    }
    const start = m.index;
    const end = start + id.length;
    const source_span = src.slice(start, end); // §2.0: byte-for-byte
    // Assert ATT&CK ONLY on an EXACT snapshot hit (Codex impl-review F1). Real
    // sub-techniques are already in the 697-entry snapshot; a sub-id absent from
    // it (T1566.999) is fake/new and must NOT be asserted via a parent fallback.
    const known = Object.prototype.hasOwnProperty.call(techniqueMap, id);
    byId.set(id, {
      id,
      name: known ? techniqueMap[id] : null,
      in_attack: known,
      source_span,
      start,
      end,
      count: 1,
    });
  }

  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return [...byId.values()]
    .sort((a, b) => cmp(a.id, b.id))
    .map((it) => ({ ...it, ...sentenceContext(src, it.start, it.end) }));
}
