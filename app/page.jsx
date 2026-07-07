"use client";

// PRD-003 — the whole product in one page, deterministic. Paste an advisory URL
// (PDF or HTML); every IOC, named threat, printed ATT&CK id, and vendor rule is
// pulled from what the document LITERALLY contains and shown with the exact source
// bytes. The URL is fetched server-side (app/api/fetch-url); extraction runs
// client-side. UI: design-room design.md — light, readable, restrained. Transform
// spine, amber accent, inline source spans, export-all-to-CSV.
import { useState, useCallback, useMemo } from "react";
import { pdfToText } from "./lib/pdfText.mjs";
import { runExtraction, defang } from "./lib/extractLoop.js";

export default function Page() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  // Given document text, run the deterministic extractor client-side.
  const extractFromText = useCallback(async (text, tooShortMsg) => {
    if (text.trim().length < 200) {
      setError(tooShortMsg);
      setBusy(false);
      return;
    }
    setStatus("Extracting…");
    const r = await runExtraction({ documentText: text });
    setResult(r);
    setStatus("");
  }, []);

  // URL intake: fetched server-side (browser CORS blocks most advisory sites),
  // then extracted client-side.
  const onUrl = useCallback(async () => {
    const u = url.trim();
    if (!u) return;
    setError(""); setResult(null);
    setBusy(true);
    try {
      setStatus("Fetching…");
      const resp = await fetch("/api/fetch-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `Fetch failed (${resp.status}).`);
      let text;
      if (data.type === "pdf") {
        setStatus("Reading PDF…");
        const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
        text = await pdfToText(bytes.buffer);
      } else {
        text = data.text || "";
      }
      await extractFromText(text, "Could not read enough text from that URL (it may be a login page, image-only, or blocked).");
    } catch (e) {
      setError(e.message || String(e));
      setStatus("");
    } finally {
      setBusy(false);
    }
  }, [url, extractFromText]);

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
        <p className="eyebrow">Theia</p>
        <h1>Pull the IOCs out of a threat intel report.</h1>
        <p className="sub">Paste a link, a PDF or a web page. Theia extracts every IOC, named threat, and the vendor&apos;s own detection rules, each tied to the exact line it came from. It runs on fixed rules, not a model, so the same report always gives the same output. Anything it can&apos;t find in the text, it drops.</p>
        <div className="proof">
          <span className="pv"><code>45.61.134.36</code><span className="ptag">ip · the line that proves it</span></span>
          <span className="pspan">&ldquo;&hellip;establishes a reverse SSH tunnel from the victim machine to the actor&apos;s C2 server with the IP address 45[.]61[.]134[.]36 and the port 443 instead of the default SSH port.&rdquo;<span className="psrc">verbatim from the Cisco Talos Chaos ransomware report</span></span>
        </div>
      </header>

      <section className="controls">
        <div className="urlrow">
          <input
            type="url"
            className="urlinput"
            placeholder="Paste an intel report URL (PDF or web page)"
            value={url}
            disabled={busy}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onUrl(); }}
          />
          <button className={`drop urlbtn ${busy || !url.trim() ? "disabled" : ""}`} onClick={onUrl} disabled={busy || !url.trim()}>
            {busy ? "Working…" : "Extract"}
          </button>
        </div>
        <span className="microtrust">100% deterministic · no LLM · no signup</span>
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
      <section className="section demo" id="see-it-run">
        <h2 className="sech">See it run</h2>
        <div className="videoframe">
          <video controls playsInline preload="metadata" poster="/theia-poster.jpg" src="/theia.mp4" />
        </div>
      </section>

      <section className="section qa">
        <h2 className="q">Did it make anything up?</h2>
        <p className="a">No. Every indicator is a <b>verbatim string</b> from the document, shown with the exact line that proves it. If a value is not literally in the text, byte for byte, it is dropped, not shown. Nothing is inferred, scored, or invented.</p>
      </section>

      <section className="section qa">
        <h2 className="q">How much of it is noise?</h2>
        <p className="a">An optional pass flags the indicators that look like <b>the vendor&apos;s own domain, a reference link, or example.com</b>, so you are not scrubbing them by hand. It only suggests. It never adds or removes anything on its own.</p>
      </section>

      <section className="section qa">
        <h2 className="q">What does it miss?</h2>
        <p className="a">It is a mechanical extractor, not a complete reader. Split or line-wrapped indicators, exotic defangs, internal hostnames, values inside screenshots, and names absent from the snapshot are <b>missed by design</b>. The source span is shown on every item so its blind spots are visible, not hidden.</p>
      </section>

      <section className="section qa">
        <h2 className="q">Can you defend it in a review?</h2>
        <p className="a">Yes. It runs on <b>fixed rules</b>, regex and curated matching, with no model in the loop. The same report gives the same output every time, and every indicator traces to a line. Reproducible and auditable, not a black box.</p>
      </section>

      <section className="section qa">
        <h2 className="q">Can you get it into your tooling?</h2>
        <p className="a">One click exports every finding to <b>CSV</b>: category, type, indicator, defanged form, count, and the source span. STIX and MISP export are on the roadmap.</p>
      </section>

      <section className="section">
        <div className="spine">
          <p className="lead">Provenance, not maliciousness. Theia asserts what a report <b>contains</b>, never what it means, whether it is malicious, or how to detect it. The Sigma sweeps it templates are hunt starting points, not deployable detections.</p>
          <div className="spinegrid">
            <div><h4>Drops what it can&apos;t prove</h4><p>A fact ships only if it matches the source byte-for-byte. Ungrounded claims are dropped, not shown.</p></div>
            <div><h4>Not a detection tool</h4><p>Not a SIEM, not a deployable-detection generator. Sweep snippets are hunt starting points, never shipped rules.</p></div>
            <div><h4>The fact layer</h4><p>Interpretation changes company to company. That is the full KTLYST product. This is the free front door.</p></div>
          </div>
        </div>
      </section>

      <footer className="foot">
        <span>Theia. The fact layer, free.</span>
        <span className="mono">100% deterministic · no signup · no LLM</span>
      </footer>
    </>
  );
}

// Quote a CSV field per RFC 4180: wrap in double-quotes and double any inner ones
// when the value has a comma, quote, or newline.
function csvField(value) {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Flatten every finding into one CSV and trigger a download. "All the findings":
// IOCs, named threats, printed ATT&CK ids, vendor rules, and IOC sweep snippets.
function exportCsv(result) {
  const rows = [["category", "type", "value", "defanged", "count", "source_span", "note"]];

  for (const o of result.iocs) {
    rows.push(["ioc", o.field_type, o.value, defang(o.value), o.count, o.context || o.source_span, ""]);
  }
  for (const kind of ["actors", "tools", "malware"]) {
    for (const e of result.entities[kind] || []) {
      rows.push(["named_threat", kind.replace(/s$/, ""), e.name, "", e.count, e.matched || "", "gazetteer match: name present, not attributed"]);
    }
  }
  for (const a of result.attack_ids.filter((x) => x.in_attack)) {
    rows.push(["attack_id", "technique", a.id, "", "", a.source_span || "", a.name || ""]);
  }
  for (const r of result.transcribed_rules) {
    rows.push(["vendor_rule", r.kind, r.text, "", "", "", "verbatim from vendor, not Theia output"]);
  }
  for (const r of result.atomic_rules) {
    rows.push(["ioc_sweep", "sigma", r.rule_yaml, "", "", r.source_span || "", `assumes ${r.category}/${r.field} (${r.match}) from ${r.field_type} ${r.value}`]);
  }

  const csv = rows.map((r) => r.map(csvField).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = "ktlyst-extract-findings.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

function Result({ result, copyText }) {
  const c = result.meta.counts;
  const attackReal = result.attack_ids.filter((a) => a.in_attack);
  const attackOther = result.attack_ids.filter((a) => !a.in_attack);
  const totalFindings =
    c.iocs + c.actors + c.tools + c.malware + attackReal.length + c.transcribed_rules + c.atomic_rules;

  return (
    <section className="result">
      <div className="resbar">
        <span><b>{c.iocs}</b> IOCs</span>
        <span><b>{c.actors + c.tools + c.malware}</b> named</span>
        <span><b>{attackReal.length}</b> ATT&amp;CK</span>
        <span><b>{c.transcribed_rules}</b> vendor rules</span>
        <span><b>{c.atomic_rules}</b> sweeps</span>
        <button className="copy exportbtn" onClick={() => exportCsv(result)} disabled={totalFindings === 0}>
          Export CSV
        </button>
      </div>

      <p className="notegood">Provenance, not opinion. Every item below is a <em>verbatim string</em> from the document, shown with its source span. This tool asserts what the report contains — never what it means, whether it is malicious, or how to detect it. It is a mechanical extractor over supported artifact types, not a complete reader: split/line-wrapped indicators, exotic defangs, internal hostnames, scanned images, and names absent from the snapshot are missed by design.</p>

      {result.iocs.length > 0 && (
        <Block title={`IOCs (${result.iocs.length})`}>
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
          <p className="notegood">The report&apos;s own Sigma/YARA/Snort rules, pulled byte-for-byte when structurally recognized. <em>Not Theia output.</em></p>
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

// IOC table. One Indicator column (the real refanged value); the proving source
// span is shown inline under it. Optional AI noise-triage is opt-in: nothing calls
// the LLM until the user clicks. The deterministic table is complete without it.
function IocTable({ iocs }) {
  const [triage, setTriage] = useState({ status: "idle", flags: null, msg: "" });

  const runTriage = async () => {
    setTriage({ status: "loading", flags: null, msg: "" });
    try {
      const resp = await fetch("/api/triage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          iocs: iocs.map((o) => ({ value: o.value, field_type: o.field_type, source_span: o.source_span })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `Triage failed (${resp.status}).`);
      const flags = new Map((data.flags || []).map((f) => [f.value, f.reason]));
      setTriage({
        status: "done",
        flags,
        msg: flags.size
          ? `${flags.size} indicator(s) flagged as likely noise. Advisory only. Nothing was removed; review each one.`
          : "No likely noise found. Nothing flagged.",
      });
    } catch (e) {
      setTriage({ status: "error", flags: null, msg: e.message || String(e) });
    }
  };

  return (
    <>
      <div className="triagebar">
        <button className="copy noisebtn" onClick={runTriage} disabled={triage.status === "loading"}>
          {triage.status === "loading" ? "Checking…" : triage.status === "done" ? "Re-check noise" : "⚠ Flag likely noise (optional AI)"}
        </button>
        <span className="assumed">Off by default. The extraction above is deterministic. This optional AI pass only suggests which IOCs look like noise (a vendor footer, a reference link). Nothing is added or removed.</span>
      </div>
      {triage.msg && <p className={triage.status === "error" ? "error" : "notewarn"}>{triage.msg}</p>}
      <div className="tablewrap">
        <table>
          <thead>
            <tr><th>Type</th><th>Indicator</th><th className="numh">Count</th></tr>
          </thead>
          <tbody>
            {iocs.map((o, i) => (
              <IocRows
                key={i}
                o={o}
                flag={triage.flags ? triage.flags.get(o.value) : null}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function IocRows({ o, flag }) {
  const ctx = o.context || o.source_span || "";
  // "Bare" = the report listed the indicator with no surrounding text, so context
  // collapsed to the indicator itself. Say that honestly instead of echoing it back.
  const bare = ctx.trim() === (o.source_span || "").trim();
  return (
    <tr className={flag ? "flagged" : ""}>
      <td className="ft">{o.field_type}</td>
      <td className="val">
        <code>{o.value}</code>
        {flag && <span className="noiseflag">⚠ likely noise</span>}
        {bare
          ? <div className="srcline bare">in the report&apos;s IOC list, no surrounding text</div>
          : <div className="srcline" title={ctx}>&ldquo;{ctx}&rdquo;</div>}
        {flag && <div className="noisewhy">{flag}</div>}
      </td>
      <td className="num">{o.count}</td>
    </tr>
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
