"use client";

// PRD-003 — the whole product in one page, deterministic. Drop a PDF; every IOC,
// named threat, printed ATT&CK id, and vendor rule is pulled from what the document
// LITERALLY contains and shown with the exact source bytes. No key, no LLM, no
// network: extraction runs entirely in your browser.
// UI: design-room design.md (2026-07-07) — light, readable, restrained. Transform
// spine, amber accent reserved for the primary action + grounded facts, source
// spans collapsed behind a per-row toggle.
import { useState, useCallback, useMemo } from "react";
import { pdfToText } from "./lib/pdfText.mjs";
import { runExtraction, defang } from "./lib/extractLoop.js";

export default function Page() {
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const onFile = useCallback(async (file) => {
    if (!file) return;
    setError(""); setResult(null); setFileName(file.name);
    setBusy(true);
    try {
      setStatus("Reading PDF…");
      const text = await pdfToText(file);
      if (text.trim().length < 200) {
        setError("Could not read enough text from this PDF (scanned/image-only PDFs need OCR — not in this build).");
        setBusy(false); return;
      }
      setStatus("Extracting…");
      const r = await runExtraction({ documentText: text });
      setResult(r);
      setStatus("");
    } catch (e) {
      setError(e.message || String(e));
      setStatus("");
    } finally {
      setBusy(false);
    }
  }, []);

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`Copied ${label}.`);
    } catch {
      setStatus(`Could not copy — select the ${label} and copy manually.`);
    }
    setTimeout(() => setStatus(""), 1800);
  };

  return (
    <main className="wrap">
      <header>
        <p className="eyebrow">KTLYST Extract</p>
        <h1>Threat PDF in, grounded intel out.</h1>
        <p className="sub">Drop a threat advisory PDF. Every observable, named threat, and vendor rule is pulled out and linked to the exact line that proves it. Seconds, not an afternoon. Runs entirely in your browser — no key, no signup, nothing leaves your machine.</p>
      </header>

      <section className="controls">
        <div className="row">
          <label className={`drop ${busy ? "disabled" : ""}`}>
            <input type="file" accept="application/pdf" disabled={busy}
              onChange={(e) => onFile(e.target.files?.[0])} />
            {fileName ? `↻ ${fileName}` : "Choose PDF"}
          </label>
          <span className="microtrust">100% deterministic · client-side · no LLM</span>
        </div>
      </section>

      {status && <p className="status">{status}</p>}
      {error && <p className="error">{error}</p>}

      {result && <Result result={result} copyText={copyText} />}

      {!result && <Landing />}
    </main>
  );
}

// The landing content below the tool: centered demo video + how it works + what
// it pulls out + the honesty spine. Hidden once a real extract is on screen.
function Landing() {
  return (
    <>
      <section className="demo section" id="demo">
        <h2 className="sech">See it run</h2>
        <div className="videoframe">
          {/* Swap this placeholder for the recorded demo, e.g.:
              <video controls playsInline poster="/demo-poster.jpg" src="/demo.mp4" /> */}
          <div className="videoplaceholder">
            <span className="playbtn" aria-hidden="true" />
            <span className="videocap">60-second demo — drop a PDF, watch it ground</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="sech">What it pulls out</h2>
          <p>Every item is a verbatim string from the document, carrying the exact source span that proves it. Nothing is inferred, summarized, or scored.</p>
        </div>
        <div className="grid">
          <div className="card"><span className="tag">typed</span><h3>IOCs</h3><p>IP, domain, URL, hash, CVE, email. Defang-aware, refanged for you. TLD and length validation cut the noise.</p></div>
          <div className="card"><span className="tag">gazetteer</span><h3>Named threats</h3><p>Actors, tools, malware matched against MITRE ATT&amp;CK + Malpedia. A match means the name is present, not attributed.</p></div>
          <div className="card"><span className="tag">printed</span><h3>ATT&amp;CK IDs</h3><p>Only the technique IDs the vendor actually wrote down, asserted as ATT&amp;CK only when in the snapshot.</p></div>
          <div className="card"><span className="tag">verbatim</span><h3>Vendor rules</h3><p>The report&apos;s own Sigma / YARA / Snort, pulled byte-for-byte with copy buttons. Labeled: not KTLYST output.</p></div>
          <div className="card"><span className="tag">templated</span><h3>IOC sweep snippets</h3><p>Single-field Sigma starting points from grounded IOCs. Hunt starters, not deployable detections. The assumed field is shown to tune.</p></div>
          <div className="card"><span className="tag">counted</span><h3>Source spans</h3><p>One click reveals the exact sentence behind any fact. The receipt is always there, never in fine print.</p></div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="sech">How it works</h2>
          <p>No key, no LLM, no server, no network. Extraction runs entirely in your browser.</p>
        </div>
        <div className="steps">
          <div className="step"><span className="n">1</span><h3>Drop the advisory</h3><p>Choose any threat-advisory PDF. The file never leaves your machine.</p></div>
          <div className="step"><span className="n">2</span><h3>Deterministic extract</h3><p>Regex and curated matching pull only what is literally in the text. Same input, same output, every time.</p></div>
          <div className="step"><span className="n">3</span><h3>Every fact linked</h3><p>Each item ships with the verbatim span that proves it. Anything not provably in the source is dropped.</p></div>
        </div>
      </section>

      <section className="section">
        <div className="spine">
          <p className="lead">Provenance, not maliciousness. This tool asserts what a report <b>contains</b> — never what it means, whether it is malicious, or how to detect it.</p>
          <div className="spinegrid">
            <div><h4>Drops what it can&apos;t prove</h4><p>A fact ships only if it matches the source byte-for-byte. Ungrounded claims are dropped, not shown.</p></div>
            <div><h4>Not a detection tool</h4><p>Not a SIEM, not a deployable-detection generator. Sweep snippets are hunt starting points, never shipped rules.</p></div>
            <div><h4>The fact layer</h4><p>Interpretation changes company to company. That is the full KTLYST product. This is the free front door.</p></div>
          </div>
        </div>
      </section>

      <footer className="foot">
        <span>KTLYST Extract — the fact layer, free and client-side.</span>
        <span className="mono">100% deterministic · no signup · nothing leaves your machine</span>
      </footer>
    </>
  );
}

function Result({ result, copyText }) {
  const c = result.meta.counts;
  const allIocValues = useMemo(
    () => result.iocs.map((i) => i.value).join("\n"),
    [result.iocs],
  );
  const attackReal = result.attack_ids.filter((a) => a.in_attack);
  const attackOther = result.attack_ids.filter((a) => !a.in_attack);

  return (
    <section className="result">
      <div className="resbar">
        <span><b>{c.iocs}</b> IOCs</span>
        <span><b>{c.actors + c.tools + c.malware}</b> named</span>
        <span><b>{attackReal.length}</b> ATT&amp;CK</span>
        <span><b>{c.transcribed_rules}</b> vendor rules</span>
        <span><b>{c.atomic_rules}</b> sweeps</span>
      </div>

      <p className="notegood">Provenance, not opinion. Every item below is a <em>verbatim string</em> from the document, shown with its source span. This tool asserts what the report contains — never what it means, whether it is malicious, or how to detect it. It is a mechanical extractor over supported artifact types, not a complete reader: split/line-wrapped indicators, exotic defangs, internal hostnames, scanned images, and names absent from the snapshot are missed by design.</p>

      {result.iocs.length > 0 && (
        <Block title={`IOCs (${result.iocs.length})`}>
          <div className="copyrow">
            <span className="assumed">Copy the real (refanged) indicators, one per line.</span>
            <button className="copy" onClick={() => copyText(allIocValues, "all IOCs")}>Copy all</button>
          </div>
          <IocTable iocs={result.iocs} />
        </Block>
      )}

      {(c.actors + c.tools + c.malware) > 0 && (
        <Block title={`Named threats — gazetteer match (${c.actors + c.tools + c.malware})`}>
          <p className="notewarn">Deterministic curated matching: these names appear in the document AND on a vendored name list (MITRE ATT&amp;CK + Malpedia). A match means the name is <strong>present</strong>, not that the actor is active or attributed — provenance, not assessment.</p>
          <EntityRow label="Actors" items={result.entities.actors} cls="chip" />
          <EntityRow label="Tools" items={result.entities.tools} cls="chip" />
          <EntityRow label="Malware" items={result.entities.malware} cls="chip mal" />
        </Block>
      )}

      {attackReal.length > 0 && (
        <Block title={`ATT&CK technique IDs printed in the report (${attackReal.length})`}>
          <p className="chips">
            {attackReal.map((a) => (
              <span key={a.id} className="ttp" title={a.source_span}>{a.id}{a.name ? ` ${a.name}` : ""}</span>
            ))}
          </p>
          {attackOther.length > 0 && (
            <p className="notewarn">Also found {attackOther.length} T#### string(s) not in the ATT&amp;CK snapshot ({attackOther.map((a) => a.id).join(", ")}) — likely table/code identifiers, not asserted as ATT&amp;CK.</p>
          )}
        </Block>
      )}

      {result.transcribed_rules.length > 0 && (
        <Block title={`Rules found in this report — verbatim from the vendor (${result.transcribed_rules.length})`}>
          <p className="notegood">The report&apos;s own Sigma/YARA/Snort rules, pulled byte-for-byte when structurally recognized. <em>Not KTLYST output.</em></p>
          {result.transcribed_rules.map((r, i) => (
            <div key={i} className="rulecard">
              <div className="rulehead">
                <span className={`kind ${r.kind}`}>{r.kind}</span>
                <button className="copy" onClick={() => copyText(r.text, `${r.kind} rule`)}>Copy</button>
              </div>
              <pre className="rulebody">{r.text}</pre>
            </div>
          ))}
        </Block>
      )}

      {result.atomic_rules.length > 0 && (
        <Block title={`IOC sweep snippets — Sigma starting points (${result.atomic_rules.length})`}>
          <p className="notewarn">Single-field IOC sweeps generated from grounded observables. These are hunt starting points, <strong>not deployable detections</strong> and not detection engineering. The assumed logsource/field is a guess — tune it, and false positives, for your environment before use.</p>
          {result.atomic_rules.map((r, i) => (
            <div key={i} className="rulecard">
              <div className="rulehead">
                <span className="kind sigma">sigma</span>
                <span className="assumed">assumes <code>{r.category}</code> · <code>{r.field}</code> ({r.match})</span>
                <button className="copy" onClick={() => copyText(r.rule_yaml, "Sigma rule")}>Copy</button>
              </div>
              <pre className="rulebody">{r.rule_yaml}</pre>
              <div className="ruletrace">from grounded {r.field_type}: <code>{r.value}</code> — “{r.source_span}”</div>
            </div>
          ))}
        </Block>
      )}
    </section>
  );
}

// IOC table with source spans collapsed behind a per-row toggle (FORK D).
function IocTable({ iocs }) {
  const [open, setOpen] = useState(() => new Set());
  const toggle = (i) => setOpen((prev) => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr><th>Type</th><th>Indicator</th><th>Defanged</th><th>Count</th><th>Source</th></tr>
        </thead>
        <tbody>
          {iocs.map((o, i) => {
            const isOpen = open.has(i);
            return (
              <IocRows key={i} o={o} i={i} isOpen={isOpen} toggle={toggle} />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function IocRows({ o, i, isOpen, toggle }) {
  return (
    <>
      <tr>
        <td className="ft">{o.field_type}</td>
        <td className="val"><code>{o.value}</code></td>
        <td className="val"><code>{defang(o.value)}</code></td>
        <td className="num">{o.count}</td>
        <td>
          <button className="srcbtn" aria-expanded={isOpen} onClick={() => toggle(i)}>
            {isOpen ? "hide ▴" : "show ▾"}
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr className="srcrow">
          <td colSpan={5}><span className="span">“{o.source_span}”</span></td>
        </tr>
      )}
    </>
  );
}

function EntityRow({ label, items, cls }) {
  if (!items || items.length === 0) return null;
  return (
    <p className="chips">
      <span className="assumed">{label}:</span>{" "}
      {items.map((e) => (
        <span key={e.name} className={cls} title={e.matched}>
          {e.name}{e.count > 1 ? ` ×${e.count}` : ""}
        </span>
      ))}
    </p>
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
