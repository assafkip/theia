// BYOK Anthropic client — runs IN THE BROWSER, mirrors the interview coach's
// app/lib/anthropic.js. The user's key leaves the browser ONLY as the x-api-key
// header to api.anthropic.com; it never touches our server, is never logged, and
// is never persisted. This is the whole point of the BYOK path.
//
// `anthropic-dangerous-direct-browser-access` is required for a browser fetch to
// the Anthropic API (CORS opt-in). It is safe here precisely because the key is
// the user's own.

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

// One non-streaming message call. Returns { text, usage }.
// `signal` lets the UI cancel an in-flight extraction.
export async function callMessage({ apiKey, model, system, user, maxTokens = 8192, signal }) {
  const res = await fetch(API_URL, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": API_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.error?.message || "";
    } catch {
      /* ignore */
    }
    throw new Error(`Anthropic API ${res.status}${detail ? `: ${detail}` : ""}`);
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { text, usage: data.usage || {} };
}
