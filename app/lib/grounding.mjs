// Deterministic source-span grounding — exact JS port of KTLYST's v007 gate
// (ktlyst_v2/gates/v007.py). This is the ground-truth layer, the analog of the
// interview coach's scorer.js: the LLM proposes structured intel, but whether a
// claimed fact is REAL is decided here, deterministically, by checking that the
// verbatim source_span appears in the document text. The model never eyeballs it.
//
// Contract (identical to v007):
//   - Case-SENSITIVE substring containment after normalization.
//   - Three normalization passes, in this order: whitespace collapse (incl.
//     U+200B ZWSP), PDF hyphenated-line-wrap collapse, typographic-punctuation
//     fold. Applied symmetrically to both the PDF text and every source_span.
//   - Empty / whitespace-only source_span => "no claim to verify" => grounded.
//
// Any change here must stay 1:1 with v007.py or the two products disagree on
// what "grounded" means.

// Pass 1: whitespace run (Python \s + U+200B ZERO WIDTH SPACE) -> single space.
const WHITESPACE_RUN = /[\s​]+/g;

// Pass 2: PDF hyphenated line-wrap. "[A-Za-z0-9]]- [a-z]" -> same without the
// space, EXCEPT when the post-hyphen token is a standalone English
// suspended-compound function word (and|or|nor|but|to|vs). Lookbehind + two
// lookaheads mean only the literal "- " (hyphen+space) is consumed and replaced.
const HYPHENATED_WRAP =
  /(?<=[A-Za-z0-9\]])- (?!(?:and|or|nor|but|to|vs)(?:[^\w-]|$))(?=[a-z])/g;

// Pass 3: typographic-punctuation -> ASCII fold. Word/Pages/DOCX exports carry
// smart quotes and en/em dashes; the LLM emits ASCII.
const TYPOGRAPHY_FOLD = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "…": "...",
};
const TYPOGRAPHY_RE = /[‘’“”–—…]/g;

// Normalize a string through the three passes, in the v007-critical order.
// Order matters: hyphen-wrap (pass 2) MUST run before the typography fold
// (pass 3), or a folded em-dash would fuse two phrases into a phantom compound.
export function normalize(s) {
  let out = String(s ?? "").replace(WHITESPACE_RUN, " ").trim();
  out = out.replace(HYPHENATED_WRAP, "-");
  out = out.replace(TYPOGRAPHY_RE, (ch) => TYPOGRAPHY_FOLD[ch] ?? ch);
  return out;
}

// Is a single source_span grounded in the (already-normalized) PDF text?
// Empty span => true (nothing to verify), matching v007's skip rule.
export function spanGrounded(sourceSpan, normalizedPdfText) {
  const span = normalize(sourceSpan);
  if (!span) return true;
  return normalizedPdfText.includes(span);
}

// Split an extraction into grounded / ungrounded observables. Mirrors
// v007.filter_grounded: every fact carrying a source_span is checked; the
// ungrounded ones are separated (the caller downgrades them, it does not
// silently ship them). Returns the same shape it received, plus the split.
//
// `extraction` is the parsed model output: { behavioral_patterns[], tools[],
// malware[], unbound_iocs[] }. Each observable/ioc has { field_type, pattern,
// source_span, confidence }.
export function groundExtraction(extraction, rawPdfText) {
  const pdf = normalize(rawPdfText);
  const dropped = [];

  const groundObservable = (obs, where) => {
    const ok = spanGrounded(obs.source_span, pdf);
    if (!ok) dropped.push({ ...obs, _where: where });
    return ok;
  };

  const grounded_patterns = [];
  for (const pattern of extraction.behavioral_patterns ?? []) {
    const observables = (pattern.observables ?? []).filter((o) =>
      groundObservable(o, "behavioral_pattern"),
    );
    // v007 drops the whole pattern only if a span is ungrounded; we keep the
    // pattern with its grounded observables so a partial extraction still ships
    // (matches filter_grounded's "surface the grounded subset" intent).
    grounded_patterns.push({ ...pattern, observables });
  }

  const grounded_iocs = (extraction.unbound_iocs ?? []).filter((o) =>
    groundObservable(o, "unbound_ioc"),
  );

  return {
    behavioral_patterns: grounded_patterns,
    tools: extraction.tools ?? [],
    malware: extraction.malware ?? [],
    unbound_iocs: grounded_iocs,
    _dropped_ungrounded: dropped,
  };
}
