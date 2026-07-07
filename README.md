# Theia

**Pull the IOCs out of a threat intel report.** Paste a link (a PDF or a web page) and
Theia extracts every IOC, named threat, and vendor detection rule that is literally in
the report, each one tied to the exact line that proves it.

Live: **[theia.ktlystlabs.com](https://theia.ktlystlabs.com)** · Free, no signup.

## Why it's different

Every other "AI reads your report" tool can hallucinate an indicator that was never in
the document. Theia can't.

- **Deterministic, not a model.** Extraction is a fixed set of rules (regex + curated
  matching). The same report always gives the same output. No LLM in the extraction path.
- **Every indicator is provably in the source, byte for byte**, and shown with the
  surrounding sentence that proves it. That's what an analyst needs: is this IP a C2, a
  victim, or a reference?
- **What it can't find in the text, it drops.** Nothing is inferred, scored, or invented.
- **Reproducible and auditable.** When you push an indicator to a blocklist, you can
  defend where it came from.

## What it extracts

- **IOCs** — IP, domain, URL, file hash (MD5 / SHA1 / SHA256), CVE, email. Defang-aware
  (`hxxps://evil[.]com` → `https://evil.com`), with false-positive guards.
- **Named threats** — actors, tools, malware matched against a vendored MITRE ATT&CK +
  Malpedia gazetteer. A match means the name is *present*, not attributed.
- **Printed MITRE ATT&CK IDs** — only the technique IDs the vendor actually wrote down.
- **Vendor rules** — the report's own Sigma / YARA / Snort, pulled verbatim (labeled: not
  Theia output).
- **IOC sweep snippets** — single-field Sigma starting points. Hunt starters, **not
  deployable detections**.

Export everything to CSV. An optional AI pass can flag likely noise (the vendor's own
domain, reference links, `example.com`) but never adds or removes an indicator.

## What it is not

Not a SIEM, not a scanner, not a deployable-detection generator. Theia asserts what a
report *contains* (provenance), never what it *means* or whether something is malicious.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # deterministic unit tests (node --test)
npm run harness      # extraction over real advisory fixtures, asserts the slice invariant
```

Pasted URLs are fetched by a small server route (browser CORS blocks most report sites);
extraction runs in your browser. The optional noise-flag needs an `ANTHROPIC_API_KEY`.

## Stack

Next.js (App Router), deterministic client-side extractors in `app/lib/`. No database, no
auth. Built by [KTLYST Labs](https://ktlystlabs.com) — Assaf Kipnis, 12 years in threat
intelligence at LinkedIn, Google, Meta, and ElevenLabs.
