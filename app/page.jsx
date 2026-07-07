"use client";

// PRD-003 — the whole product in one page, deterministic. Drop a PDF; every IOC,
// named threat, printed ATT&CK id, and vendor rule is pulled from what the document
// LITERALLY contains and shown with the exact source bytes. No key, no LLM, no
// network: extraction runs entirely in your browser. Functional UI only.
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
        <h1>KTLYST Extract</h1>
        <p className="sub">Advisory in, hunt-ready IOCs out. Drop a threat advisory PDF and every observable, named threat, and vendor rule is pulled out and linked to the exact line that proves it. Runs entirely in your browser — no key, no signup, nothing leaves your machine.</p>
      </header>

      <section className="controls">
        <div className="row">
          <label className={`drop ${busy ? "disabled" : ""}`}>
            <input type="file" accept="application/pdf" disabled={busy}
              onChange={(e) => onFile(e.target.files?.[0])} />
            {fileName ? `↻ ${fileName}` : "Choose PDF"}
          </label>
        </div>
      </section>

      {status && <p className="status">{status}</p>}
      {error && <p className="error">{error}</p>}

      {result && <Result result={result} copyText={copyText} />}
    </main>
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
        <span>{c.iocs} IOCs · {c.actors + c.tools + c.malware} named · {attackReal.length} ATT&amp;CK · {c.transcribed_rules} vendor rules · {c.atomic_rules} sweeps</span>
      </div>

      <p className="notegood">Provenance, not opinion. Every item below is a verbatim string from the document, shown with its source span. This tool asserts what the report <em>contains</em> — never what it <em>means</em>, whether it is malicious, or how to detect it. It is a mechanical extractor over supported artifact types, not a complete reader: split/line-wrapped indicators, exotic defangs, internal hostnames, scanned images, and names absent from the snapshot are missed by design.</p>

      {result.iocs.length > 0 && (
        <Block title={`IOCs (${result.iocs.length})`}>
          <div className="rulehead">
            <span className="assumed">Copy the real (refanged) indicators, one per line.</span>
            <button onClick={() => copyText(allIocValues, "all IOCs")}>Copy all</button>
          </div>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Type</th><th>Indicator</th><th>Defanged</th><th>Source span (verbatim)</th><th>×</th></tr></thead>
              <tbody>
                {result.iocs.map((o, i) => (
                  <tr key={i}>
                    <td className="ft">{o.field_type}</td>
                    <td className="val"><code>{o.value}</code></td>
                    <td className="val"><code>{defang(o.value)}</code></td>
                    <td className="span">“{o.source_span}”</td>
                    <td className="ft">{o.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <p className="notegood">The report&apos;s own Sigma/YARA/Snort rules, pulled byte-for-byte when structurally recognized. Not KTLYST output.</p>
          {result.transcribed_rules.map((r, i) => (
            <div key={i} className="rulecard">
              <div className="rulehead">
                <span className={`kind ${r.kind}`}>{r.kind}</span>
                <button onClick={() => copyText(r.text, `${r.kind} rule`)}>Copy</button>
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
                <button onClick={() => copyText(r.rule_yaml, "Sigma rule")}>Copy</button>
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
