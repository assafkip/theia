"use client";

// The whole product in one page (BYOK path): paste your key, drop a PDF, get a
// grounded structured extract. Functional UI only — design is deferred per the
// build directive (mirror the coach's capability, not its look).
import { useState, useCallback } from "react";
import { pdfToText } from "./lib/pdfText.mjs";
import { runExtraction, MODELS } from "./lib/extractLoop.js";

const KEY_STORE = "ktlyst_extract_byok"; // sessionStorage only, never sent to us.

export default function Page() {
  const [apiKey, setApiKey] = useState(() =>
    typeof window !== "undefined" ? sessionStorage.getItem(KEY_STORE) || "" : "",
  );
  const [tier, setTier] = useState("best");
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const onKey = (v) => {
    setApiKey(v);
    try { sessionStorage.setItem(KEY_STORE, v); } catch { /* ignore */ }
  };

  const onFile = useCallback(async (file) => {
    if (!file) return;
    setError(""); setResult(null); setFileName(file.name);
    if (!apiKey.startsWith("sk-ant-")) {
      setError("Enter your Anthropic API key (starts with sk-ant-) first.");
      return;
    }
    setBusy(true);
    try {
      setStatus("Reading PDF…");
      const text = await pdfToText(file);
      if (text.trim().length < 200) {
        setError("Could not read enough text from this PDF (scanned/image-only PDFs need OCR — not in this MVP).");
        setBusy(false); return;
      }
      setStatus(`Extracting with ${tier === "best" ? "Opus 4.8" : "Haiku 4.5"}…`);
      const r = await runExtraction({ apiKey, model: MODELS[tier], documentText: text });
      setResult(r);
      setStatus("");
    } catch (e) {
      setError(e.message || String(e));
      setStatus("");
    } finally {
      setBusy(false);
    }
  }, [apiKey, tier]);

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setStatus("Copied JSON to clipboard.");
    setTimeout(() => setStatus(""), 1500);
  };

  return (
    <main className="wrap">
      <header>
        <h1>KTLYST Extract</h1>
        <p className="sub">Drop a threat advisory PDF. Get structured, source-grounded intel back. Every fact is checked against the document — fabricated ones are dropped.</p>
      </header>

      <section className="controls">
        <label className="field">
          <span>Anthropic API key <em>(stays in your browser — never sent to us)</em></span>
          <input type="password" value={apiKey} placeholder="sk-ant-…"
            onChange={(e) => onKey(e.target.value)} autoComplete="off" />
        </label>

        <div className="row">
          <label className="field inline">
            <span>Model</span>
            <select value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="best">Opus 4.8 (best)</option>
              <option value="fast">Haiku 4.5 (fast/cheap)</option>
            </select>
          </label>

          <label className={`drop ${busy ? "disabled" : ""}`}>
            <input type="file" accept="application/pdf" disabled={busy}
              onChange={(e) => onFile(e.target.files?.[0])} />
            {fileName ? `↻ ${fileName}` : "Choose PDF"}
          </label>
        </div>
      </section>

      {status && <p className="status">{status}</p>}
      {error && <p className="error">{error}</p>}

      {result && (
        <section className="result">
          <div className="resbar">
            <span>{result.meta.model} · ~${result.meta.cost_usd} · {result.meta.output_tokens} out-tokens</span>
            <button onClick={copyJson}>Copy JSON</button>
          </div>

          {result.dropped_ungrounded.length > 0 && (
            <p className="dropped">⚠ {result.dropped_ungrounded.length} claimed fact(s) dropped — not verbatim in the source. This is the grounding gate working.</p>
          )}

          {result.exec_summary.length > 0 && (
            <Block title="Executive summary">
              <ul>{result.exec_summary.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </Block>
          )}

          {result.actors.length > 0 && (
            <Block title={`Actors (${result.actors.length})`}>
              <p className="chips">{result.actors.map((a, i) => <span key={i} className="chip">{a}</span>)}</p>
            </Block>
          )}

          {(result.tools.length > 0 || result.malware.length > 0) && (
            <Block title="Tooling & malware">
              <p className="chips">
                {result.tools.map((t, i) => <span key={`t${i}`} className="chip">{t}</span>)}
                {result.malware.map((m, i) => <span key={`m${i}`} className="chip mal">{m}</span>)}
              </p>
            </Block>
          )}

          <Block title={`TTPs / behavioral patterns (${result.behavioral_patterns.length})`}>
            {result.behavioral_patterns.map((p, i) => (
              <div key={i} className="pattern">
                <div className="pseq">{p.sequence}
                  {(p.mitre_attack_ids || []).map((id) => <span key={id} className="ttp">{id}</span>)}
                </div>
                {p.detection_idea && <div className="pdet">{p.detection_idea}</div>}
                <IocTable rows={p.observables} />
              </div>
            ))}
          </Block>

          {result.unbound_iocs.length > 0 && (
            <Block title={`Standalone IOCs (${result.unbound_iocs.length})`}>
              <IocTable rows={result.unbound_iocs} />
            </Block>
          )}
        </section>
      )}
    </main>
  );
}

function Block({ title, children }) {
  return (
    <div className="block">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function IocTable({ rows }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="tablewrap">
      <table>
        <thead><tr><th>Type</th><th>Value</th><th>Source span (verbatim)</th></tr></thead>
        <tbody>
          {rows.map((o, i) => (
            <tr key={i}>
              <td className="ft">{o.field_type}</td>
              <td className="val"><code>{o.pattern}</code></td>
              <td className="span">“{o.source_span}”</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
