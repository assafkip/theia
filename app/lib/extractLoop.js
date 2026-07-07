// The extract loop — PRD-003 deterministic pivot. No LLM, no key, no network.
//
//   PDF text --> [ iocExtract | entities | attackIds | ruleTranscribe | sigma ] --> UI
//
// Every artifact is pulled from what the document LITERALLY contains and carries a
// byte-for-byte source span (§2.0). The tool asserts provenance, never opinion:
// no summary, no detection ideas, no confidence, no inferred ATT&CK mapping. Those
// belong to the full KTLYST product (the per-company opinion layer).

import { extractIocs, refang, defang } from "./iocExtract.mjs";
import { detectEntities } from "./entities.mjs";
import { extractAttackIds } from "./attackIds.mjs";
import { atomicRulesFromExtraction } from "./sigmaTemplate.mjs";
import { transcribeRules } from "./ruleTranscribe.mjs";

export { refang, defang };

// Lazy-load the vendored gazetteer + stoplist (Codex F12: keep them out of the
// initial route bundle; import after the user has dropped a PDF). Cached after
// first load. Tests inject data directly and never hit this path.
let _data = null;
async function loadData() {
  if (_data) return _data;
  const [gaz, stop] = await Promise.all([
    import("./gazetteer.json"),
    import("./entity-stoplist.json"),
  ]);
  _data = {
    gazetteer: gaz.default ?? gaz,
    stoplist: (stop.default ?? stop).stoplist ?? [],
  };
  return _data;
}

// Adapt the deterministic IOC set into the observable shape sigmaTemplate expects
// ({ field_type, pattern, source_span }). The templater's refang-aware gate (F1)
// reconciles the real `value` against the possibly-defanged span.
function iocsToObservables(iocs) {
  return {
    behavioral_patterns: [],
    unbound_iocs: iocs.map((i) => ({
      field_type: i.field_type,
      pattern: i.value,
      source_span: i.source_span,
    })),
  };
}

// Run one extraction end-to-end. Pure over its inputs. `gazetteer`/`stoplist` are
// optional (injected in tests); in the app they are lazy-loaded. Returns only
// grounded, provenance-carrying facts — no opinion fields.
export async function runExtraction({ documentText, gazetteer, stoplist } = {}) {
  const text = String(documentText ?? "");

  const data = gazetteer ? { gazetteer, stoplist: stoplist ?? [] } : await loadData();

  const iocs = extractIocs(text);
  const attack_ids = extractAttackIds(text, data.gazetteer.techniques ?? {});
  const transcribed_rules = transcribeRules(text);
  const atomic_rules = atomicRulesFromExtraction(iocsToObservables(iocs), text);
  const entitiesFlat = detectEntities(text, data.gazetteer, data.stoplist);

  const entities = {
    actors: entitiesFlat.filter((e) => e.kind === "actor"),
    tools: entitiesFlat.filter((e) => e.kind === "tool"),
    malware: entitiesFlat.filter((e) => e.kind === "malware"),
  };

  return {
    iocs,
    entities,
    attack_ids,
    transcribed_rules,
    atomic_rules,
    meta: {
      counts: {
        iocs: iocs.length,
        actors: entities.actors.length,
        tools: entities.tools.length,
        malware: entities.malware.length,
        attack_ids: attack_ids.length,
        transcribed_rules: transcribed_rules.length,
        atomic_rules: atomic_rules.length,
      },
    },
  };
}
