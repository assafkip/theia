// Server-side URL fetch for advisory intake. The founder lifted the "nothing
// leaves your machine" promise for URL intake (2026-07-07): a pasted URL is
// fetched here, server-side, because browser CORS blocks almost every real
// advisory site. Extraction still runs client-side on the returned text, so the
// deterministic grounding path is unchanged. Uploaded PDFs still never leave the
// browser — only pasted URLs hit this route.
//
// Returns { type: "pdf", base64 } (client runs pdfToText for identical spacing)
// or { type: "text", text } for HTML pages (stripped to text here).

import { lookup } from "node:dns/promises";
import net from "node:net";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB cap
const TIMEOUT_MS = 12_000;

// SSRF guard: reject anything that could reach our own infra / a private network.
// Resolve the host and check every returned address against private ranges.
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true;
    if (a === 127) return true; // loopback
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === "::1") return true; // loopback
    if (low.startsWith("fe80")) return true; // link-local
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // unique-local
    if (low.startsWith("::ffff:")) return isPrivateIp(low.slice(7)); // v4-mapped
    return false;
  }
  return true; // unknown format: refuse
}

async function assertPublicUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("That is not a valid URL.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported.");
  }
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("That host is not allowed.");
  }
  // If the host is a literal IP, check it directly; else resolve and check all.
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("That address is not allowed.");
  } else {
    const addrs = await lookup(host, { all: true });
    if (addrs.some((a) => isPrivateIp(a.address))) {
      throw new Error("That host resolves to a private address.");
    }
  }
  return u;
}

function stripHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|br|li|tr|h[1-6]|section|article|pre|td)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a JSON body with a url field." }, { status: 400 });
  }
  const raw = (body?.url || "").trim();
  if (!raw) return Response.json({ error: "No URL provided." }, { status: 400 });

  let url;
  try {
    url = await assertPublicUrl(raw);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let resp;
  try {
    resp = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // A real UA; some advisory sites reject empty/robot agents.
        "user-agent":
          "Mozilla/5.0 (compatible; KTLYST-Extract/1.0; +https://ktlyst-extract.vercel.app)",
        accept: "application/pdf,text/html,*/*",
      },
    });
  } catch (e) {
    clearTimeout(timer);
    const msg = e?.name === "AbortError" ? "The site took too long to respond." : "Could not reach that URL.";
    return Response.json({ error: msg }, { status: 502 });
  }
  clearTimeout(timer);

  if (!resp.ok) {
    return Response.json({ error: `The site returned ${resp.status}.` }, { status: 502 });
  }

  const len = Number(resp.headers.get("content-length") || 0);
  if (len && len > MAX_BYTES) {
    return Response.json({ error: "That document is too large (over 15 MB)." }, { status: 413 });
  }

  const buf = new Uint8Array(await resp.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    return Response.json({ error: "That document is too large (over 15 MB)." }, { status: 413 });
  }

  const ctype = (resp.headers.get("content-type") || "").toLowerCase();
  const looksPdf =
    ctype.includes("application/pdf") ||
    url.pathname.toLowerCase().endsWith(".pdf") ||
    (buf.length > 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46); // %PDF

  if (looksPdf) {
    // Hand the raw bytes to the client so pdfToText runs there with the same
    // spacing the upload path uses (grounding depends on that symmetry).
    const base64 = Buffer.from(buf).toString("base64");
    return Response.json({ type: "pdf", base64, source: url.href });
  }

  const html = new TextDecoder("utf-8").decode(buf);
  const text = stripHtml(html);
  return Response.json({ type: "text", text, source: url.href });
}
