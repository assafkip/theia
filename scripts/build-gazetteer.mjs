// PRD-003 Feature 6 — deterministic gazetteer + TLD + stoplist builder.
//
// Founder rule: name lists are DATA, refreshed by a script, never hand-edited in
// code. This tool fetches canonical public sources at BUILD time and emits the
// three vendored JSON files the runtime reads. The app never fetches at runtime.
//
// Sources:
//   - IANA TLD list        -> app/lib/tlds.json
//   - MITRE ATT&CK STIX     -> actors / tools / malware names+aliases, technique map
//   - Malpedia families     -> additional malware family names+aliases (graceful)
//
// Codex F8: every alias is cross-checked against a common-word + security-term set;
// high-risk collisions (and length < 4, and all-digit) are auto-added to the
// stoplist, and a collision report is printed so the curation is auditable.
//
// Run: node scripts/build-gazetteer.mjs   (or: npm run gazetteer)

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const LIB = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "lib");

const IANA_TLD = "https://data.iana.org/TLD/tlds-alpha-by-domain.txt";
const ATTACK_STIX =
  "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json";
const MALPEDIA = "https://malpedia.caad.fkie.fraunhofer.de/api/get/families";

// Minimum alias length; anything shorter is too collision-prone to match on.
const MIN_ALIAS_LEN = 4;

// Common English + security-jargon words that appear as ATT&CK/Malpedia aliases
// but would flood real advisories with false hits. This is the versioned decision
// log (Codex F9): mechanical rule (below) plus this explicit list. Extendable.
const COMMON_WORDS = new Set(
  (
    "the and for are but not you all any can had her was one our out day get has him his how man new now old see two way who boy did its let put say she too use dad mom " +
      "menu cat fancy comment wizard carbon ember gold silence charming cozy sale ninja spider panda bear kitten tiger dragon phoenix ghost shadow storm winter summer " +
      "group actor tool malware report sample payload target victim campaign threat access agent server client update config system network process service module plugin " +
      "team unit cell node core edge base data file host user admin root guest test demo temp cache queue stack heap frame block chain token round trip"
  )
    .split(/\s+/)
    .map((w) => w.toLowerCase()),
);

async function getText(url, ms = 60000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

function dedupeCI(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const v = String(raw ?? "").trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

async function buildTlds() {
  const txt = await getText(IANA_TLD, 20000);
  const tlds = txt
    .split("\n")
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l && !l.startsWith("#"))
    // store as ".tld" for cheap suffix checks; skip punycode xn-- (rare in advisories)
    .filter((l) => !l.startsWith("xn--"))
    .map((l) => `.${l}`);
  tlds.push(".onion"); // Codex F5: allow Tor hidden-service names
  return dedupeCI(tlds).sort();
}

async function buildFromAttack() {
  const bundle = JSON.parse(await getText(ATTACK_STIX, 120000));
  const actors = [];
  const tools = [];
  const malware = [];
  const techniques = {};

  for (const o of bundle.objects ?? []) {
    if (o.revoked || o.x_mitre_deprecated) continue;
    if (o.type === "intrusion-set") {
      actors.push({ name: o.name, aliases: dedupeCI(o.aliases ?? []) });
    } else if (o.type === "malware") {
      malware.push({ name: o.name, aliases: dedupeCI(o.x_mitre_aliases ?? []) });
    } else if (o.type === "tool") {
      tools.push({ name: o.name, aliases: dedupeCI(o.x_mitre_aliases ?? []) });
    } else if (o.type === "attack-pattern") {
      const ref = (o.external_references ?? []).find(
        (r) => r.source_name === "mitre-attack" && /^T\d{4}(\.\d{3})?$/.test(r.external_id ?? ""),
      );
      if (ref) techniques[ref.external_id] = o.name;
    }
  }
  return { actors, tools, malware, techniques };
}

async function buildMalpedia() {
  try {
    const data = JSON.parse(await getText(MALPEDIA, 60000));
    const fams = [];
    for (const v of Object.values(data)) {
      if (!v || !v.common_name) continue;
      fams.push({ name: v.common_name, aliases: dedupeCI(v.alt_names ?? v.aliases ?? []) });
    }
    return fams;
  } catch (e) {
    console.warn(`  ! Malpedia unavailable (${e.message}); MITRE malware only.`);
    return [];
  }
}

// Merge entries by canonical name (case-insensitive), unioning aliases.
function mergeByName(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const { name, aliases } of list) {
      const key = String(name).toLowerCase();
      if (!map.has(key)) map.set(key, { name, aliases: [] });
      map.get(key).aliases.push(...aliases);
    }
  }
  return [...map.values()]
    .map((e) => ({ name: e.name, aliases: dedupeCI(e.aliases).filter((a) => a.toLowerCase() !== e.name.toLowerCase()) }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// Codex F8: cross-check every term against the collision rule; auto-stoplist and
// report. A term is stoplisted if: length < MIN_ALIAS_LEN, all digits, or in the
// common-word set. Names are stoplisted for MATCHING only (kept as canonical, just
// not matchable via that surface). Returns { stoplist:[...], report:{...} }.
function buildStoplist(groups) {
  const stop = new Set();
  const report = { tooShort: [], allDigits: [], commonWord: [] };
  const consider = (term) => {
    const t = String(term).trim();
    const low = t.toLowerCase();
    if (t.length < MIN_ALIAS_LEN) {
      stop.add(low);
      report.tooShort.push(t);
    } else if (/^\d+$/.test(t)) {
      stop.add(low);
      report.allDigits.push(t);
    } else if (COMMON_WORDS.has(low)) {
      stop.add(low);
      report.commonWord.push(t);
    }
  };
  for (const list of groups) {
    for (const { name, aliases } of list) {
      consider(name);
      aliases.forEach(consider);
    }
  }
  for (const k of Object.keys(report)) report[k] = dedupeCI(report[k]).sort();
  return { stoplist: [...stop].sort(), report };
}

async function main() {
  console.log("Building gazetteer from canonical sources...");
  const [tlds, attack, malpedia] = await Promise.all([
    buildTlds(),
    buildFromAttack(),
    buildMalpedia(),
  ]);

  const actors = mergeByName(attack.actors);
  const tools = mergeByName(attack.tools);
  const malware = mergeByName(attack.malware, malpedia);
  const { stoplist, report } = buildStoplist([actors, tools, malware]);

  const gazetteer = {
    _source: {
      attack: ATTACK_STIX,
      malpedia: malpedia.length ? MALPEDIA : "unavailable-at-build",
      note: "Vendored snapshot. Refresh with: node scripts/build-gazetteer.mjs",
    },
    actors,
    tools,
    malware,
    techniques: attack.techniques,
  };

  await writeFile(join(LIB, "gazetteer.json"), JSON.stringify(gazetteer) + "\n");
  await writeFile(join(LIB, "tlds.json"), JSON.stringify(tlds) + "\n");
  await writeFile(
    join(LIB, "entity-stoplist.json"),
    JSON.stringify({ stoplist, _report: report }, null, 0) + "\n",
  );

  console.log(
    `  actors=${actors.length} tools=${tools.length} malware=${malware.length} ` +
      `techniques=${Object.keys(attack.techniques).length} tlds=${tlds.length}`,
  );
  console.log(
    `  stoplist=${stoplist.length} (short=${report.tooShort.length} ` +
      `digits=${report.allDigits.length} common=${report.commonWord.length})`,
  );
}

main().catch((e) => {
  console.error("build-gazetteer failed:", e.message);
  process.exit(1);
});
