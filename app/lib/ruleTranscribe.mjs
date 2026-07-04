// Rule transcription — Feature 1 of PRD-002. Advisories often ship their own
// Sigma/YARA/Snort rules in appendices. This does ZERO authoring: it finds those
// blocks, pulls them BYTE-FOR-BYTE (raw contiguous slices, not normalized), and
// grounds each against the PDF as a sanity gate. The UI copies the exact raw
// slice and labels it as the vendor's own text — never as KTLYST output.
//
// Codex PRD review drove two rules here: (1) return RAW slices with offsets so
// transcription is provably verbatim (normalization is only a secondary gate);
// (2) require real structural markers + balanced capture so advisory prose that
// merely mentions "title:" or "alert" is not mistaken for a rule.

import { normalize } from "./grounding.mjs";

const MAX_BLOCK = 8192; // a real rule is well under this; caps runaway capture.

// YARA rule head: optional `global`/`private` modifiers, `rule <ident>`, optional
// `: tags`, then `{` (which may sit on the next line). \s* before the brace lets
// the opening brace wrap.
const YARA_HEAD = /\b(?:global\s+|private\s+)*rule\s+[A-Za-z_]\w*[ \t]*(?::[ \t]*[\w \t]+)?\s*\{/;

// Top-level Sigma keys — used to bound an unfenced Sigma block: a non-indented,
// non-blank line that is NOT one of these (and not a fence / next title:) is
// prose, and ends the block. This tolerates blank lines INSIDE the rule.
const SIGMA_KEY = /^(?:title|id|name|status|description|references?|author|date|modified|logsource|detection|fields|falsepositives|level|tags|related|filter)\s*:/;

// Classify a raw block by kind, or null if it is not a rule. Multi-marker: a
// block must carry the STRUCTURE of its kind, not just a keyword.
export function classifyRule(text) {
  const t = String(text ?? "");
  if (YARA_HEAD.test(t) && /\bcondition\s*:/.test(t)) return "yara";
  if (/^[ \t]*(?:alert|drop|reject|pass|sdrop)\b/im.test(t) && /\bsid\s*:\s*\d+/.test(t)) return "snort";
  if (/(?:^|\n)[ \t]*title\s*:/.test(t) && /\bdetection\s*:/.test(t) && /\bcondition\s*:/.test(t)) return "sigma";
  return null;
}

// ``` ... ``` fenced regions -> raw inner slices with offsets. The `d` flag gives
// exact capture-group indices, so text.slice(start,end) === inner regardless of
// fence length or inner content (no hand offset arithmetic).
function fencedBlocks(text) {
  const re = /```[^\n]*\n([\s\S]*?)```/gd;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    const [start, end] = m.indices[1];
    out.push({ start, end, text: m[1] });
  }
  return out;
}

// YARA: `rule <ident> ... {` then a BALANCED-brace scan to the matching `}`,
// requiring a `condition:` inside.
function yaraBlocks(text) {
  const re = new RegExp(YARA_HEAD.source, "g");
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    const start = m.index;
    let depth = 1;
    let end = -1;
    let inStr = false; // inside a double-quoted YARA string
    const open = m.index + m[0].length - 1; // index of the '{'
    for (let k = open + 1; k < text.length && k - start < MAX_BLOCK; k++) {
      const c = text[k];
      if (inStr) {
        if (c === "\\") { k++; continue; } // skip escaped char
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; continue; } // don't count braces inside strings
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) { end = k + 1; break; }
      }
    }
    if (end === -1) continue;
    const slice = text.slice(start, end);
    if (/\bcondition\s*:/.test(slice)) out.push({ start, end, text: slice });
    re.lastIndex = end;
  }
  return out;
}

// Snort/Suricata: a single physical `alert|drop|reject|pass|sdrop ...` line that
// carries a `sid:<n>`. (Multi-line backslash continuation is out of v1 scope; a
// wrapped rule may be missed — we prefer a miss over a false positive.)
function snortBlocks(text) {
  const re = /^[ \t]*(?:alert|drop|reject|pass|sdrop)\b[^\n]*$/gim;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    const slice = m[0];
    if (slice.length < MAX_BLOCK && /\bsid\s*:\s*\d+/.test(slice)) {
      out.push({ start: m.index, end: m.index + slice.length, text: slice });
    }
  }
  return out;
}

// Unfenced Sigma: from a `title:` line, capture a bounded window (until two blank
// lines, the next `title:`, or a cap) and keep it only if it carries detection +
// condition markers.
function sigmaBlocks(text) {
  const lines = text.split("\n");
  const offsets = [];
  let acc = 0;
  for (const ln of lines) { offsets.push(acc); acc += ln.length + 1; }

  const out = [];
  const MAXL = 120;
  for (let i = 0; i < lines.length; i++) {
    if (!/^[ \t]*title\s*:/.test(lines[i])) continue;
    // Capture the contiguous YAML block. A line BELONGS if it is blank, indented,
    // or a top-level Sigma key. The block ends at a fence, the next title:, or the
    // first non-indented non-key prose line. This tolerates blank lines inside the
    // rule while still refusing to swallow following prose / other rules.
    let j = i + 1;
    let lastContent = i; // last real (non-blank) content line
    for (; j < lines.length && j - i < MAXL; j++) {
      const ln = lines[j];
      if (/^\s*$/.test(ln)) continue; // internal blank -> tolerate, don't extend end
      if (/^\s*```/.test(ln)) break; // fence
      if (/^[ \t]*title\s*:/.test(ln)) break; // next rule
      if (/^\s/.test(ln) || SIGMA_KEY.test(ln)) { lastContent = j; continue; }
      break; // non-indented, non-key, non-blank -> prose -> stop
    }
    const start = offsets[i];
    const end = offsets[lastContent] + lines[lastContent].length;
    if (end - start < MAX_BLOCK) {
      const slice = text.slice(start, end);
      if (/\bdetection\s*:/.test(slice) && /\bcondition\s*:/.test(slice)) {
        out.push({ start, end, text: slice });
      }
    }
    i = Math.max(i, lastContent); // resume after the captured block
  }
  return out;
}

// All candidate rule blocks as RAW slices { kind, text, start, end }.
export function findRuleBlocks(text) {
  const src = String(text ?? "");
  const cands = [];
  for (const b of fencedBlocks(src)) {
    const kind = classifyRule(b.text);
    if (kind) cands.push({ ...b, kind });
  }
  for (const b of yaraBlocks(src)) cands.push({ ...b, kind: "yara" });
  for (const b of snortBlocks(src)) cands.push({ ...b, kind: "snort" });
  for (const b of sigmaBlocks(src)) cands.push({ ...b, kind: "sigma" });
  return cands;
}

// Grounding sanity gate for a block: its normalized text must be non-empty AND
// contained in the normalized PDF. Slices come from the PDF, so this holds by
// construction; the gate catches capture bugs (e.g. cross-region concatenation).
export function groundRuleBlock(block, pdfText) {
  const n = normalize(block?.text ?? "");
  if (!n) return false;
  return normalize(pdfText).includes(n);
}

// Find -> ground -> dedupe/de-nest -> document order. Returns { kind, text } with
// text = the exact raw slice (byte-for-byte from the extracted PDF text).
export function transcribeRules(pdfText) {
  const src = String(pdfText ?? "");
  const pdfNorm = normalize(src);

  let cands = findRuleBlocks(src).filter((c) => {
    const n = normalize(c.text);
    return n.length > 0 && pdfNorm.includes(n);
  });

  // De-nest by OFFSET RANGE, not by text-substring: drop a candidate only when its
  // range is nested inside a kept candidate's range (e.g. the unfenced-Sigma
  // sub-capture inside its own fenced block), or its normalized text is an exact
  // duplicate. Two DISTINCT rules at different offsets are both kept even if one's
  // text happens to be a substring of the other's.
  cands.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const kept = [];
  for (const c of cands) {
    const nested = kept.some((k) => k.start <= c.start && c.end <= k.end);
    if (nested) continue;
    const dup = kept.some((k) => normalize(k.text) === normalize(c.text));
    if (dup) continue;
    kept.push(c);
  }
  kept.sort((a, b) => a.start - b.start); // document order for display
  return kept.map((c) => ({ kind: c.kind, text: c.text }));
}
