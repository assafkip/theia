// The extract loop — the analog of the coach's runCoachTurn. Same shape:
// the LLM proposes, a DETERMINISTIC layer is the source of truth.
//
//   PDF text --> callMessage (LLM extracts) --> parseJson --> groundExtraction
//                                                             (v007 port = truth)
//
// The model's raw output is never trusted as-is: every claimed observable must
// survive the grounding substring check or it is dropped. What the UI renders is
// the grounded subset plus the list of what got dropped (honesty, not silence).

import { callMessage } from "./anthropic.js";
import { SYSTEM_PROMPT, buildUserMessage } from "./extractPrompt.mjs";
import { groundExtraction } from "./grounding.mjs";
import { atomicRulesFromExtraction } from "./sigmaTemplate.mjs";
import { transcribeRules } from "./ruleTranscribe.mjs";

// Model tiers mirror the coach: a cheap tier for free/acquisition, Opus for paid.
export const MODELS = {
  fast: "claude-haiku-4-5-20251001",
  best: "claude-opus-4-8",
};
const PRICE = {
  "claude-opus-4-8": { in: 5 / 1e6, out: 25 / 1e6 },
  "claude-haiku-4-5-20251001": { in: 1 / 1e6, out: 5 / 1e6 },
};

// Parse the model's JSON. Mirrors ttp_story._parse_json: strip code fences, try
// strict JSON.parse, and on failure attempt a best-effort recovery of the
// outermost object rather than hard-failing the whole extraction.
export function parseJson(text) {
  let body = String(text ?? "").trim();
  if (body.startsWith("```")) {
    body = body.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  try {
    return JSON.parse(body);
  } catch {
    const first = body.indexOf("{");
    const last = body.lastIndexOf("}");
    if (first !== -1 && last > first) {
      return JSON.parse(body.slice(first, last + 1));
    }
    throw new Error("Model did not return parseable JSON.");
  }
}

function costUsd(model, usage) {
  const p = PRICE[model] || PRICE["claude-opus-4-8"];
  return (usage.input_tokens || 0) * p.in + (usage.output_tokens || 0) * p.out;
}

// Run one extraction end-to-end. `documentText` is the raw PDF text (also used as
// the grounding source — the same bytes the model read are the bytes we check
// against, so grounding is honest).
export async function runExtraction({ apiKey, model, documentText, signal }) {
  const { text, usage } = await callMessage({
    apiKey,
    model,
    system: SYSTEM_PROMPT,
    user: buildUserMessage(documentText),
    signal,
  });

  const parsed = parseJson(text);
  const grounded = groundExtraction(parsed, documentText);

  // Detection-rule support (PRD-002), both deterministic:
  //  - atomic_rules: atomic Sigma templated from the GROUNDED IOC set (the LLM
  //    never authors these — a fixed table slots a grounded value into a shape).
  //  - transcribed_rules: Sigma/YARA/Snort blocks the advisory itself shipped,
  //    pulled verbatim from the document text and grounded.
  const atomic_rules = atomicRulesFromExtraction(grounded, documentText);
  const transcribed_rules = transcribeRules(documentText);

  return {
    exec_summary: Array.isArray(parsed.exec_summary) ? parsed.exec_summary : [],
    actors: Array.isArray(parsed.actors) ? parsed.actors : [],
    behavioral_patterns: grounded.behavioral_patterns,
    tools: grounded.tools,
    malware: grounded.malware,
    unbound_iocs: grounded.unbound_iocs,
    dropped_ungrounded: grounded._dropped_ungrounded,
    atomic_rules,
    transcribed_rules,
    meta: {
      model,
      cost_usd: Number(costUsd(model, usage).toFixed(4)),
      input_tokens: usage.input_tokens || 0,
      output_tokens: usage.output_tokens || 0,
    },
  };
}
