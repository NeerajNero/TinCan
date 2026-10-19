#!/usr/bin/env node
/**
 * Builds the daily-word definitions shipped as static files.
 *
 *   pnpm words:definitions
 *
 * Reads every word in `src/content/words-answers.json`, looks it up in the WordNet 3.1 database
 * (the `wordnet-db` devDependency, parsed here directly: index.sense for sense frequency, data.*
 * for the gloss) and writes 26 files `public/words/{a..z}.json`, one per first letter, each a map
 * `word → { pos, meaning, example? }`. The most frequently tagged sense wins; the first gloss
 * clause becomes `meaning` (≤ 120 chars) and the first quoted clause `example`.
 *
 * Words WordNet doesn't know (and any word that needs a better line than WordNet's) live in
 * `src/content/word-definitions-manual.json`, which is merged on top. Missing words are listed at
 * the end so they can be added there. Re-run only when the answer list changes; the output is
 * committed.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const dictPath = require("wordnet-db").path;

const answers = JSON.parse(readFileSync(join(root, "src/content/words-answers.json"), "utf8"));
const manualPath = join(root, "src/content/word-definitions-manual.json");
const manual = JSON.parse(readFileSync(manualPath, "utf8"));
const outDir = join(root, "public/words");

const MAX_LEN = 120;
const POS_NAME = { n: "noun", v: "verb", a: "adjective", s: "adjective", r: "adverb" };
const POS_FILE = { n: "noun", v: "verb", a: "adj", s: "adj", r: "adv" };
const POS_RANK = { n: 0, v: 1, a: 2, s: 2, r: 3 };
const SS_TYPE = { 1: "n", 2: "v", 3: "a", 4: "r", 5: "s" };

const wanted = new Set(answers);

/** lemma → [{ pos, offset, senseNo, tagCnt }] from index.sense (lemma%ss_type:lex_filenum:lex_id:: offset sense_no tag_cnt). */
function readSenses() {
  const byLemma = new Map();
  for (const line of readFileSync(join(dictPath, "index.sense"), "utf8").split("\n")) {
    if (!line) continue;
    const [key, offset, senseNo, tagCnt] = line.split(" ");
    const pct = key.indexOf("%");
    const lemma = key.slice(0, pct);
    if (!wanted.has(lemma)) continue;
    const pos = SS_TYPE[key.slice(pct + 1, pct + 2)];
    const list = byLemma.get(lemma) ?? [];
    list.push({ pos, offset, senseNo: Number(senseNo), tagCnt: Number(tagCnt) });
    byLemma.set(lemma, list);
  }
  return byLemma;
}

/** Random access into data.* by byte offset: the offset in index.sense is the byte position of the line. */
const dataBuffers = new Map();
function gloss(pos, offset) {
  const file = POS_FILE[pos];
  if (!dataBuffers.has(file)) dataBuffers.set(file, readFileSync(join(dictPath, `data.${file}`)));
  const buf = dataBuffers.get(file);
  const start = Number(offset);
  const end = buf.indexOf("\n", start);
  const line = buf.subarray(start, end === -1 ? undefined : end).toString("utf8");
  const bar = line.indexOf("|");
  return bar === -1 ? "" : line.slice(bar + 1).trim();
}

function clip(text) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= MAX_LEN) return t;
  const cut = t.slice(0, MAX_LEN - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 60)).replace(/[,;:]$/, "")}…`;
}

/** Split a WordNet gloss into its definition clauses and quoted examples. */
function parseGloss(raw) {
  const parts = raw.split(";").map((p) => p.trim()).filter(Boolean);
  const defs = [];
  const examples = [];
  for (const p of parts) {
    const quoted = p.match(/^"(.+)"(?:\s*-\s*.+)?$/);
    if (quoted) examples.push(quoted[1]);
    else defs.push(p);
  }
  return { defs, examples };
}

function bestSense(senses) {
  return [...senses].sort((a, b) => b.tagCnt - a.tagCnt || POS_RANK[a.pos] - POS_RANK[b.pos] || a.senseNo - b.senseNo)[0];
}

const senses = readSenses();
const built = {};
const missing = [];
let fromWordNet = 0;
let fromManual = 0;

for (const word of answers) {
  if (manual[word]) {
    built[word] = manual[word];
    fromManual++;
    continue;
  }
  const list = senses.get(word);
  if (!list) {
    missing.push(word);
    continue;
  }
  const sense = bestSense(list);
  const { defs, examples } = parseGloss(gloss(sense.pos, sense.offset));
  if (defs.length === 0) {
    missing.push(word);
    continue;
  }
  const entry = { pos: POS_NAME[sense.pos], meaning: clip(defs[0]) };
  // Examples belong to the whole synset, so only keep one that actually uses this word (by stem).
  const stem = word.slice(0, 4).toLowerCase();
  const example = examples.find((e) => e.toLowerCase().includes(stem));
  if (example) entry.example = clip(example);
  built[word] = entry;
  fromWordNet++;
}

mkdirSync(outDir, { recursive: true });
for (const letter of "abcdefghijklmnopqrstuvwxyz") {
  const subset = Object.fromEntries(
    Object.keys(built)
      .filter((w) => w.startsWith(letter))
      .sort()
      .map((w) => [w, built[w]]),
  );
  writeFileSync(join(outDir, `${letter}.json`), JSON.stringify(subset));
}

const sizes = readdirSync(outDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ f, bytes: statSync(join(outDir, f)).size }))
  .sort((a, b) => b.bytes - a.bytes);
const total = sizes.reduce((s, x) => s + x.bytes, 0);

console.log(`words: ${answers.length}`);
console.log(`defined: ${fromWordNet + fromManual} (WordNet ${fromWordNet}, manual ${fromManual})`);
console.log(`largest file: public/words/${sizes[0].f} ${(sizes[0].bytes / 1024).toFixed(1)} KB · total ${(total / 1024).toFixed(1)} KB across ${sizes.length} files`);
if (missing.length) {
  console.log(`missing (${missing.length}) — add to src/content/word-definitions-manual.json:`);
  console.log(missing.join(" "));
  process.exitCode = 2;
}
