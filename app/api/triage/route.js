// prompt-only-enforcement-skip -- this is application code (an LLM feature route),
// not a governance doc claiming prompt-only enforcement. The "advisory only"
// guarantees below are enforced by the value-mapping code at the bottom, not prose.
//
// OPTIONAL AI pass: false-positive / noise triage over the ALREADY-grounded IOCs.
// Advisory only, by construction:
//  - Runs on an explicit user click (the UI keeps it opt-in; LLM-free default).
//  - Adds/removes nothing: the mapping at the bottom keys each flag to a value
//    that already exists in the deterministic output and returns only {value,
//    reason}. Any index the model returns outside that set is discarded, so the
//    response cannot introduce a new fact or delete an extracted one.
//  - Output is a noise flag for human review (the vendor's own site, footer /
//    reference links, example.com) per issue #3, not a maliciousness verdict.
//
// Server-side call with a server-held key (process.env.ANTHROPIC_API_KEY). If the
// key is absent the route degrades gracefully and the UI stays fully usable.

export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5"; // cheap tier (model-allocation policy)

export async function POST(request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return Response.json(
      { error: "AI triage is not configured on this deployment." },
      { status: 503 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a JSON body with an iocs array." }, { status: 400 });
  }
  const iocs = Array.isArray(body?.iocs) ? body.iocs.slice(0, 200) : [];
  if (iocs.length === 0) return Response.json({ flags: [] });

  const list = iocs
    .map((o, i) => `${i + 1}. [${o.field_type}] ${o.value} :: ${String(o.source_span || "").slice(0, 200)}`)
    .join("\n");

  const prompt = `You are triaging indicators (IOCs) that were mechanically extracted from a threat advisory. Every one is provably present in the document, but some are NOT real threat observables. They are NOISE: the reporting vendor's own domain, social/footer/reference links, documentation URLs, example.com, RFC/standards references, or common benign CDN/infrastructure that the advisory merely mentions.

Identify ONLY the entries you are reasonably confident are noise / benign references rather than attacker infrastructure. Unflagged entries stay untouched; this pass judges noise, never malice. Low confidence means omit the entry.

Indicators:
${list}

Return STRICT JSON only, no prose, no code fence:
{"flags":[{"n":<the number from the list>,"reason":"<short reason, max 12 words>"}]}
If none are noise, return {"flags":[]}.`;

  let resp;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    return Response.json({ error: "Could not reach the AI service." }, { status: 502 });
  }

  if (!resp.ok) {
    return Response.json({ error: `AI service returned ${resp.status}.` }, { status: 502 });
  }

  const data = await resp.json();
  const text = (data?.content || []).map((b) => b?.text || "").join("").trim();

  // Parse the model's JSON defensively (strip any accidental fence, grab the object).
  let parsed = null;
  try {
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    parsed = JSON.parse(start >= 0 ? cleaned.slice(start, end + 1) : cleaned);
  } catch {
    return Response.json({ error: "AI returned an unreadable response." }, { status: 502 });
  }

  // Map the 1-based indices back to IOC values. Advisory only; drop anything odd.
  const flags = [];
  for (const f of parsed?.flags || []) {
    const idx = Number(f?.n) - 1;
    if (Number.isInteger(idx) && idx >= 0 && idx < iocs.length) {
      flags.push({ value: iocs[idx].value, reason: String(f?.reason || "likely noise").slice(0, 120) });
    }
  }
  return Response.json({ flags });
}
