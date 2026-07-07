// PRD-003 follow-up — the "line that proves it" made real.
//
// Widen a matched indicator span [start,end) to the SENTENCE it sits in, returned as
// a byte-for-byte slice of the source: `context === text.slice(context_start,
// context_end)`. This is what an analyst actually needs — the sentence around an IOC
// tells them whether it is a C2, a victim, or a reference. The bare `source_span`
// (the indicator itself) still proves presence; `context` proves *where*.
//
// Deterministic and bounded: same input, same output. Scar: the tool shipped claiming
// "the exact line that proves it" while `source_span` was just the indicator echoed
// back (170.130.165[.]73 → "170.130.165[.]73") — a circular, worthless receipt. This
// makes the claim true. When an indicator sits alone on a line (a bare IOC-list row),
// the context deterministically collapses back to the indicator: no sentence is
// invented, so the honesty spine holds.

const TERMINATORS = new Set([".", "!", "?"]);

export function sentenceContext(text, start, end, opts = {}) {
  const src = String(text ?? "");
  const n = src.length;
  const maxBack = opts.maxBack ?? 200;
  const maxFwd = opts.maxFwd ?? 200;
  const cap = opts.cap ?? 320;

  start = Math.max(0, Math.min(start, n));
  end = Math.max(start, Math.min(end, n));

  // Walk backward to the sentence start: a newline, or just past a "terminator + space"
  // boundary, or the back-window edge.
  let s = start;
  const backEdge = Math.max(0, start - maxBack);
  while (s > backEdge) {
    const prev = src[s - 1];
    if (prev === "\n" || prev === "\r") break;
    if (prev === " " && TERMINATORS.has(src[s - 2])) break;
    s--;
  }

  // Walk forward to the sentence end: through a terminator followed by whitespace/EOF,
  // or to a newline, or the forward-window edge.
  let e = end;
  const fwdEdge = Math.min(n, end + maxFwd);
  while (e < fwdEdge) {
    const ch = src[e];
    if (ch === "\n" || ch === "\r") break;
    e++;
    if (TERMINATORS.has(ch)) {
      const after = src[e];
      if (after === undefined || after === " " || after === "\n" || after === "\r") break;
    }
  }

  // Trim surrounding whitespace and dangling cell separators ("·") by moving indices
  // inward (slice-equality preserved).
  while (s < start && /[\s·|]/.test(src[s])) s++;
  while (e > end && /[\s·|]/.test(src[e - 1])) e--;

  // Enforce the length cap, never cutting into the indicator itself.
  if (e - s > cap) {
    let over = e - s - cap;
    const cutFront = Math.min(over, start - s);
    s += cutFront;
    over -= cutFront;
    e -= Math.min(over, e - end);
    while (s < start && /\s/.test(src[s])) s++;
    while (e > end && /\s/.test(src[e - 1])) e--;
  }

  return { context: src.slice(s, e), context_start: s, context_end: e };
}
