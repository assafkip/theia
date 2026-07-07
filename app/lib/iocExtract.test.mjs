// PRD-003 Feature 1 tests — deterministic IOC extraction, defang, FP controls,
// and the §2.0 byte-for-byte provenance invariant.

import { test } from "node:test";
import assert from "node:assert/strict";
import { extractIocs, refang, defang } from "./iocExtract.mjs";

// §2.0 invariant helper: every item's span must be exactly text.slice(start,end).
function assertSliceEquality(text, items) {
  for (const it of items) {
    assert.equal(text.slice(it.start, it.end), it.source_span, `slice != span for ${it.value}`);
    assert.ok(it.source_span.trim().length > 0, `empty span for ${it.value}`);
  }
}
const only = (items, ft) => items.filter((i) => i.field_type === ft);
const vals = (items, ft) => only(items, ft).map((i) => i.value);

test("ip: clean and defanged, span byte-for-byte", () => {
  const text = "beacon to 8.8.8.8 and 10[.]0[.]0[.]1 seen";
  const items = extractIocs(text);
  assert.deepEqual(vals(items, "ip"), ["10.0.0.1", "8.8.8.8"]);
  const defanged = only(items, "ip").find((i) => i.value === "10.0.0.1");
  assert.equal(defanged.source_span, "10[.]0[.]0[.]1");
  assertSliceEquality(text, items);
});

test("ip: octet > 255 rejected; version strings rejected (incl. colon form)", () => {
  assert.deepEqual(vals(extractIocs("build v1.2.3.4 shipped"), "ip"), []);
  assert.deepEqual(vals(extractIocs("bogus 999.1.1.1 here"), "ip"), []);
  assert.deepEqual(vals(extractIocs("version 1.2.3.4"), "ip"), []);
  assert.deepEqual(vals(extractIocs("version: 1.2.3.4"), "ip"), []); // Codex F5
  assert.deepEqual(vals(extractIocs("ver. 1.2.3.4"), "ip"), []);
  // a real IP with no version prefix still extracts
  assert.deepEqual(vals(extractIocs("callback 8.8.4.4 seen"), "ip"), ["8.8.4.4"]);
});

test("url: comma/semicolon-separated list does NOT collapse (Codex F2)", () => {
  const items = extractIocs("iocs: https://a.com/x,https://b.com/y;https://c.com/z");
  assert.deepEqual(
    vals(items, "url").sort(),
    ["https://a.com/x", "https://b.com/y", "https://c.com/z"],
  );
});

test("domain: clean and defanged; refang canonical", () => {
  const text = "c2 at evil.com and backup hxxps colon removed evil2[.]net";
  const items = extractIocs(text);
  assert.ok(vals(items, "domain").includes("evil.com"));
  assert.ok(vals(items, "domain").includes("evil2.net"));
  assertSliceEquality(text, items);
});

test("domain: .onion allowed; non-TLD rejected", () => {
  const items = extractIocs("market at abcdef.onion not file.zzzznotatld");
  assert.ok(vals(items, "domain").includes("abcdef.onion"));
  assert.ok(!vals(items, "domain").some((d) => d.includes("zzzznotatld")));
});

test("domain: filename lookalike (invoice.zip) is NOT a domain (Codex F4)", () => {
  const items = extractIocs("dropped invoice.zip and sample.mov to disk");
  assert.deepEqual(vals(items, "domain"), []);
});

test("url: captured; bare domain inside it is suppressed (Codex F4)", () => {
  const text = "visit (https://evil.com/a/b). also hxxps://bad[.]net/x";
  const items = extractIocs(text);
  assert.deepEqual(
    vals(items, "url").sort(),
    ["https://bad.net/x", "https://evil.com/a/b"],
  );
  // evil.com must not ALSO appear as a bare domain (it is inside the URL span)
  assert.ok(!vals(items, "domain").includes("evil.com"));
  assertSliceEquality(text, items);
});

test("url: trailing prose punctuation trimmed, span still slice-equal", () => {
  const text = "ref https://evil.com/path, then done";
  const items = extractIocs(text);
  const u = only(items, "url")[0];
  assert.equal(u.value, "https://evil.com/path");
  assert.equal(u.source_span, "https://evil.com/path");
});

test("email: clean and defanged; bare domain inside suppressed", () => {
  const text = "contact bad@evil.com or phish[at]evil2[.]net now";
  const items = extractIocs(text);
  assert.ok(vals(items, "email").includes("bad@evil.com"));
  assert.ok(vals(items, "email").includes("phish@evil2.net"));
  assert.ok(!vals(items, "domain").includes("evil.com"));
  assertSliceEquality(text, items);
});

test("file_hash: md5/sha1/sha256 lengths", () => {
  const md5 = "d41d8cd98f00b204e9800998ecf8427e";
  const sha1 = "da39a3ee5e6b4b0d3255bfef95601890afd80709";
  const sha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const items = extractIocs(`hashes ${md5} ${sha1} ${sha256}`);
  assert.deepEqual(vals(items, "file_hash").sort(), [md5, sha1, sha256].sort());
});

test("file_hash: over-length hex run yields NO hash (Codex F7)", () => {
  const run65 = "a".repeat(65);
  const items = extractIocs(`blob ${run65} end`);
  assert.deepEqual(vals(items, "file_hash"), []);
});

test("file_hash: dashed GUID not a hash", () => {
  const items = extractIocs("id 550e8400-e29b-41d4-a716-446655440000 here");
  assert.deepEqual(vals(items, "file_hash"), []);
});

test("cve: uppercased canonical", () => {
  const items = extractIocs("exploits cve-2021-44228 aka log4shell");
  assert.deepEqual(vals(items, "cve"), ["CVE-2021-44228"]);
});

test("dedupe by (type,value) keeps first span, counts occurrences", () => {
  const text = "8.8.8.8 then again 8.8.8.8 twice";
  const items = extractIocs(text);
  const ip = only(items, "ip");
  assert.equal(ip.length, 1);
  assert.equal(ip[0].count, 2);
  assert.equal(ip[0].start, text.indexOf("8.8.8.8"));
});

test("stable sort: field_type then value", () => {
  const items = extractIocs("z.com a.com 1.1.1.1 CVE-2020-0001");
  const order = items.map((i) => i.field_type);
  const sorted = [...order].sort();
  assert.deepEqual(order, sorted);
});

test("refang is deterministic and idempotent on clean input", () => {
  assert.equal(refang("hxxps://evil[.]com"), "https://evil.com");
  assert.equal(refang("a[dot]b[dot]c"), "a.b.c");
  assert.equal(refang("https://evil.com"), "https://evil.com");
});

test("defang produces non-clickable form", () => {
  assert.equal(defang("https://evil.com"), "hxxps://evil[.]com");
});

test("empty / junk input yields no items and does not throw", () => {
  assert.deepEqual(extractIocs(""), []);
  assert.deepEqual(extractIocs(null), []);
  assert.deepEqual(extractIocs("just words, no indicators."), []);
});
