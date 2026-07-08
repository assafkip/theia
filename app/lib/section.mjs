// PRD-003 follow-up — deconfliction awareness, made deterministic.
//
// Threat reports routinely carry a "known-good / deconfliction / testing" block:
// real-looking hashes, domains, and filenames that are BENIGN — blue-team test
// artifacts, sandbox infra, samples the report explicitly clears. Regex can't read a
// section header, so those extract exactly like attacker infrastructure. This module
// gives each indicator a HINT (not a verdict): if the nearest section heading above it
// reads as benign/deconfliction, it is tagged `section_hint: "benign"` and carries the
// verbatim heading that triggered it. It NEVER removes an indicator — extract-all and
// human-decides still holds; this only surfaces more of the context the analyst needs.
//
// Honesty spine: best-effort. Reports with no headings, or benign items scattered in
// prose rather than under a heading, are a documented miss. A threat heading
// ("Indicators of Compromise", "C2 infrastructure") scanning backward wins over any
// benign heading above it, so an IOC under an IOC list is never mislabelled benign.

// Benign / deconfliction section vocabulary. A heading matching this marks the
// indicators beneath it as analyst-cleared: test artifacts, deconfliction lists,
// known-good samples — not attacker infrastructure.
const BENIGN =
  /\b(?:deconflict\w*|benign|known[-\s]?good|legitimate|non[-\s]?malicious|clean(?:\s+(?:file|hash|sample|indicator)\w*)?|false[-\s]?positives?|whitelist\w*|allow[-\s]?list\w*|excluded|testing|test\s+(?:infra\w*|indicator\w*|artifact\w*|host\w*|data))\b/i;

// A neutral/threat section heading STOPS benign inheritance. Scanning backward, once
// we hit an "Indicators of Compromise" / "C2" / "Malicious" heading, the nearest
// section is that one — not any benign heading further up.
const THREAT =
  /\b(?:indicators?\s+of\s+compromise|iocs?|network\s+indicators?|host\s+indicators?|c2\b|command[-\s]and[-\s]control|malicious|attacker|threat\s+infra\w*)\b/i;

// A line is "heading-shaped" if it is short and not a prose sentence. Rejects
// multi-sentence lines (". " mid-line) so a benign/threat WORD buried in prose does
// not read as a section boundary. A single trailing period is fine (headings rarely
// have one, IOC-list rows never do).
function isHeadingish(line) {
  const t = line.trim();
  if (t.length < 2 || t.length > 80) return false;
  if (/[.!?]\s+\S/.test(t)) return false; // prose, not a heading
  if (/[.!?]$/.test(t)) return false; // sentences end this way, headings don't
  return true;
}

// Scan backward from the indicator's line to the nearest section heading. Returns
// { hint: "benign", heading } when that heading is benign, else null. Bounded: at most
// `maxLines` / `maxBack` chars, so a benign heading at the top of a long doc does not
// tag the whole document.
export function sectionHint(text, start, opts = {}) {
  const src = String(text ?? "");
  const maxLines = opts.maxLines ?? 40;
  const maxBack = opts.maxBack ?? 4000;

  let pos = Math.max(0, Math.min(start, src.length));
  const backEdge = Math.max(0, pos - maxBack);

  // Move to the start of the indicator's own line first (don't test the line the
  // indicator sits on as its own heading).
  let lineEnd = src.lastIndexOf("\n", pos - 1);
  let scanned = 0;
  while (lineEnd >= backEdge && scanned < maxLines) {
    const lineStart = src.lastIndexOf("\n", lineEnd - 1) + 1;
    const raw = src.slice(lineStart, lineEnd);
    if (isHeadingish(raw)) {
      if (BENIGN.test(raw)) {
        return { section_hint: "benign", section_heading: raw.trim() };
      }
      if (THREAT.test(raw)) return null; // threat section wins
    }
    scanned++;
    lineEnd = lineStart - 1;
  }
  return null;
}
