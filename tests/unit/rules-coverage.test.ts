/**
 * Every Firestore collection and every RTDB top-level node the client code
 * touches must have an explicit block in the rule templates. Phase 21's live
 * trivia stall was a node the rules simply didn't mention (RTDB denies
 * silently), so this scans `src/` and fails with the list of uncovered paths.
 *
 * The scan is reliable because all client access goes through the wrappers:
 * Firestore paths are the string arguments of `doc(...)` / `collection(...)`
 * from `@/lib/firebase/fs`, RTDB paths the literal or template given to
 * `ref(...)` / `rtdbRef(...)` / `r(...)` (and the path helper literals in
 * files that import `@/lib/firebase/rt` or `@/lib/rtdb`). A template that
 * starts with `${x}` is resolved from x's string-union type, a `const x =`,
 * or JSX `x="…"` / `x={`…`}` props anywhere in src; one that can't be
 * resolved fails too, so a new indirection can't slip past.
 *
 * The same scan reads every Firestore `query(...)` and works out whether its
 * `where` / `orderBy` combination needs a composite index (Firestore answers
 * such a query with failed-precondition until the index exists). Any that
 * does must be listed in `firestore.indexes.json`, which `pnpm rules:deploy`
 * deploys; the failure prints the exact entry to add. Ordering by document
 * id descending is flagged too: it needs a `__name__ DESC` index the file
 * can't express, so order ascending over an id range instead.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const SRC = join(root, "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}
const files = walk(SRC).map((p) => ({ path: relative(root, p), text: readFileSync(p, "utf8") }));
const imports = (text: string, mod: string) => new RegExp(`from "${mod.replace(/[/.]/g, (c) => `\\${c}`)}"`).test(text);
const fsFiles = files.filter((f) => imports(f.text, "@/lib/firebase/fs"));
const rtFiles = files.filter((f) => imports(f.text, "@/lib/firebase/rt") || imports(f.text, "@/lib/rtdb"));
const adminFiles = files.filter((f) => /firebase-admin|@\/lib\/firebase\/admin/.test(f.text)).map((f) => f.path);

/** The argument text of every `name(` call, balanced over nested parens. */
function callArgs(text: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`(?<![\\w.])${name}\\(`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < text.length && depth > 0; i++) {
      const c = text[i];
      if (c === "(") depth++;
      else if (c === ")") depth--;
    }
    out.push(text.slice(start, i - 1));
  }
  return out;
}
/** Top-level comma split (ignores commas inside parens, braces, brackets and quotes). */
function splitArgs(args: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = "";
  for (const c of args) {
    if (quote) {
      cur += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    if ("([{".includes(c)) depth++;
    if (")]}".includes(c)) depth--;
    if (c === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}
const literal = (arg: string): string | null => (/^"[^"]*"$|^'[^']*'$/.test(arg) ? arg.slice(1, -1) : null);

/* ── Firestore ─────────────────────────────────────────────────────────── */

interface Use {
  pattern: string;
  where: string;
}

/** `lists/⋆/items` for doc(db, "lists", kind, "items", id): the collection names with a wildcard between (⋆ stands for `*` here). */
function firestoreUses(): Use[] {
  const uses: Use[] = [];
  for (const f of fsFiles) {
    if (adminFiles.includes(f.path)) continue;
    for (const fn of ["doc", "collection"]) {
      for (const args of callArgs(f.text, fn)) {
        const segs = splitArgs(args).slice(1).flatMap((a) => {
          const lit = literal(a);
          return lit === null ? ["*"] : lit.split("/");
        });
        if (segs.length === 0 || segs[0] === "*") continue; // a ref passed through (doc(colRef, id)), counted where the ref is made
        const collections = segs.filter((_, i) => i % 2 === 0);
        uses.push({ pattern: collections.join("/*/"), where: f.path });
      }
    }
  }
  return uses;
}

/** Collection patterns the template matches explicitly: `users`, `lists/⋆/items`, `capsules/⋆/private`. */
function firestoreCovered(): Set<string> {
  const tmpl = readFileSync(join(root, "rules/firestore.rules.tmpl"), "utf8");
  const covered = new Set<string>();
  const stack: Array<{ path: string[]; depth: number }> = [];
  let depth = 0;
  for (const line of tmpl.split(/\r?\n/)) {
    const m = line.match(/^\s*match\s+(\S+)\s*\{\s*$/);
    if (m && !m[1]!.startsWith("/databases/")) {
      const segs = m[1]!.split("/").filter(Boolean).map((s) => (s.startsWith("{") ? "*" : s));
      const parent = stack.length ? stack[stack.length - 1]!.path : [];
      const path = [...parent, ...segs];
      stack.push({ path, depth });
      covered.add(path.filter((_, i) => i % 2 === 0).join("/*/"));
    }
    // Path wildcards like {capsuleId} are not blocks.
    for (const c of line.replace(/\{[^}\s]*\}/g, "")) {
      if (c === "{") depth++;
      if (c === "}") {
        depth--;
        while (stack.length && stack[stack.length - 1]!.depth >= depth) stack.pop();
      }
    }
  }
  return covered;
}

/* ── RTDB ──────────────────────────────────────────────────────────────── */

/** First path segment(s) a literal or template denotes; templates led by `${x}` are resolved from x's values. */
function rtdbHeads(raw: string, file: string, unresolved: string[]): string[] {
  const body = raw.slice(1, -1);
  if (body.startsWith(".")) return []; // .info/*
  if (raw.startsWith("`") && body.startsWith("${")) {
    const name = body.match(/^\$\{(\w+)/)?.[1] ?? "";
    const values = resolveValues(name, file);
    if (!values.length) unresolved.push(`${file}: ${raw}`);
    return values.map((v) => v.split("/")[0]!);
  }
  const head = body.split(/[/$]/)[0]!;
  return /^[A-Za-z]\w*$/.test(head) ? [head] : [];
}

/**
 * String values a variable can take, nearest scope first: its union type or
 * const assignment in the same file (`kind: "watch" | "listen"`), else a path
 * helper of that name anywhere (`presencePath = (uid) => \`presence/...\``),
 * else JSX props anywhere (`base="whiteboard"`, `base={\`pictionary/...\`}`).
 */
function resolveValues(name: string, file: string): string[] {
  const esc = name.replace(/\$/g, "\\$");
  const union = new RegExp(`\\b${esc}\\??:\\s*\\(?((?:"[^"]+"\\s*\\|\\s*)+"[^"]+")`, "g");
  const assign = new RegExp(`\\b${esc}\\s*=\\s*("[^"]+")`, "g");
  const helper = new RegExp(`\\b${esc}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*(?:"([^"]+)"|\`([^\`]+)\`)`, "g");
  const jsx = new RegExp(`\\b${esc}=(?:"([^"]+)"|\\{\`([^\`]+)\`\\})`, "g");
  const scan = (texts: string[], res: RegExp[]): string[] => {
    const values = new Set<string>();
    for (const text of texts) {
      for (const re of res) {
        let m: RegExpExecArray | null;
        re.lastIndex = 0;
        while ((m = re.exec(text))) {
          if (re === union) for (const v of m[1]!.match(/"[^"]+"/g) ?? []) values.add(v.slice(1, -1));
          else values.add((m[1] ?? m[2])!);
        }
      }
    }
    return [...values].filter((v) => /^[A-Za-z]/.test(v));
  };
  const here = files.filter((f) => f.path === file).map((f) => f.text);
  const all = files.map((f) => f.text);
  return scan(here, [union, assign]).length ? scan(here, [union, assign]) : scan(all, [helper]).length ? scan(all, [helper]) : scan(all, [jsx]);
}

function rtdbUses(unresolved: string[]): Use[] {
  const uses: Use[] = [];
  for (const f of rtFiles) {
    if (adminFiles.includes(f.path)) continue;
    const literals = new Set<string>();
    // Path arguments of the reference makers.
    for (const fn of ["ref", "rtdbRef", "r"]) {
      for (const args of callArgs(f.text, fn)) for (const a of splitArgs(args)) if (/^["'`]/.test(a)) literals.add(a);
    }
    // Path helpers (`presencePath = (uid) => \`presence/${uid}\``) and paths handed to useRtdbValue.
    for (const m of f.text.matchAll(/=>\s*(`[A-Za-z]\w*\/[^`]*`|"[A-Za-z]\w*\/[^"]*")/g)) literals.add(m[1]!);
    for (const args of callArgs(f.text, "useRtdbValue")) for (const a of splitArgs(args)) if (/^["'`]/.test(a)) literals.add(a);
    for (const lit of literals) for (const head of rtdbHeads(lit, f.path, unresolved)) uses.push({ pattern: head, where: f.path });
  }
  return uses;
}

function rtdbCovered(): Set<string> {
  const tmpl = JSON.parse(readFileSync(join(root, "rules/database.rules.json.tmpl"), "utf8")) as { rules: Record<string, unknown> };
  return new Set(Object.keys(tmpl.rules).filter((k) => !k.startsWith(".") && !k.startsWith("$")));
}


/* ── Firestore composite indexes ───────────────────────────────────────── */

interface IndexField {
  fieldPath: string;
  order?: "ASCENDING" | "DESCENDING";
  arrayConfig?: "CONTAINS";
}
interface QuerySpec {
  /** Equality-style filters (==, in, array-contains, array-contains-any) as index fields. */
  equality: IndexField[];
  /** Fields with a range / inequality filter (<, <=, >, >=, !=, not-in). */
  range: string[];
  orderBy: IndexField[];
  /** Filter or order fields given as variables, which this scan can't judge. */
  unresolved: string[];
}
interface QueryUse extends QuerySpec {
  where: string;
  group: string | null;
  text: string;
}

const ARRAY_OPS = new Set(["array-contains", "array-contains-any"]);
const EQUALITY_OPS = new Set(["==", "in", ...ARRAY_OPS]);
const RTDB_ONLY = /\b(orderByKey|orderByChild|orderByValue|limitToLast|limitToFirst|equalTo)\(/;
const fieldKey = (f: IndexField) => `${f.fieldPath}:${f.arrayConfig ?? f.order ?? "ASCENDING"}`;

/** The filters and orders inside one `query(...)` argument list. */
function parseQueryArgs(args: string): QuerySpec {
  const spec: QuerySpec = { equality: [], range: [], orderBy: [], unresolved: [] };
  for (const w of callArgs(args, "where")) {
    const [field, op] = splitArgs(w).map((a) => literal(a));
    if (field === null || field === undefined || op === null || op === undefined) {
      spec.unresolved.push(`where(${w})`);
      continue;
    }
    if (ARRAY_OPS.has(op)) spec.equality.push({ fieldPath: field, arrayConfig: "CONTAINS" });
    else if (EQUALITY_OPS.has(op)) spec.equality.push({ fieldPath: field, order: "ASCENDING" });
    else spec.range.push(field);
  }
  for (const o of callArgs(args, "orderBy")) {
    const [field, dir] = splitArgs(o);
    const path = field === "documentId()" ? "__name__" : literal(field ?? "");
    if (path === null) {
      spec.unresolved.push(`orderBy(${o})`);
      continue;
    }
    spec.orderBy.push({ fieldPath: path, order: literal(dir ?? "") === "desc" ? "DESCENDING" : "ASCENDING" });
  }
  return spec;
}

/**
 * The composite index a query needs, or null when the built-in single-field
 * indexes serve it: equality-only filters (Firestore merges their indexes),
 * one order, or one range field ordered by itself. Equality + order/range on
 * another field, two orders, two range fields, or a range ordered by another
 * field need `[equalities…, orders…, remaining range]`. `__name__` descending
 * is reported as a need on purpose (see the header).
 */
function requiredIndex(q: QuerySpec): { fields: IndexField[]; equalityCount: number } | null {
  const ranges = [...new Set(q.range)];
  const orders = q.orderBy.map((f) => f.fieldPath);
  const needs =
    orders.length > 1 ||
    (q.equality.length > 0 && (orders.length > 0 || ranges.length > 0)) ||
    ranges.length > 1 ||
    (ranges.length === 1 && orders.some((f) => f !== ranges[0])) ||
    q.orderBy.some((f) => f.fieldPath === "__name__" && f.order === "DESCENDING");
  if (!needs) return null;
  const tail = [...q.orderBy];
  for (const r of ranges) if (!tail.some((t) => t.fieldPath === r)) tail.push({ fieldPath: r, order: "ASCENDING" });
  const equality = [...new Map(q.equality.map((f) => [fieldKey(f), f])).values()].sort((a, b) => a.fieldPath.localeCompare(b.fieldPath));
  return { fields: [...equality, ...tail], equalityCount: equality.length };
}

/** Does a `firestore.indexes.json` entry serve this need? Equality fields may come in any order; the rest must match in order. */
function indexServes(entry: IndexField[], need: IndexField[], equalityCount: number): boolean {
  if (entry.length !== need.length) return false;
  const sortedKeys = (fs: IndexField[]) => fs.map(fieldKey).sort().join(",");
  return sortedKeys(entry.slice(0, equalityCount)) === sortedKeys(need.slice(0, equalityCount)) && entry.slice(equalityCount).map(fieldKey).join(",") === need.slice(equalityCount).map(fieldKey).join(",");
}

/** The last collection name of `collection(db, "lists", kind, "items")`, or null. */
function groupOfCollectionCall(args: string): string | null {
  const segs = splitArgs(args).slice(1).flatMap((a) => {
    const lit = literal(a);
    return lit === null ? ["*"] : lit.split("/");
  });
  const collections = segs.filter((_, i) => i % 2 === 0);
  const last = collections[collections.length - 1];
  return last && last !== "*" ? last : null;
}

/** Collection group of a query's first argument: an inline `collection(...)` or a `const xCol = (…) => collection(...)` helper anywhere in src. */
function resolveGroup(first: string): string | null {
  const inline = callArgs(first, "collection")[0];
  if (inline !== undefined) return groupOfCollectionCall(inline);
  const name = first.match(/^(\w+)\(/)?.[1];
  if (!name) return null;
  const def = new RegExp(`\\b${name}\\s*=\\s*(?:\\([^)]*\\)\\s*=>\\s*)?collection\\(`);
  for (const f of fsFiles) {
    const m = def.exec(f.text);
    if (!m) continue;
    const args = callArgs(f.text.slice(m.index), "collection")[0];
    return args === undefined ? null : groupOfCollectionCall(args);
  }
  return null;
}

function firestoreQueries(): QueryUse[] {
  const uses: QueryUse[] = [];
  for (const f of fsFiles) {
    if (adminFiles.includes(f.path)) continue;
    for (const args of callArgs(f.text, "query")) {
      if (RTDB_ONLY.test(args)) continue;
      const [first] = splitArgs(args);
      if (first === undefined) continue;
      uses.push({ ...parseQueryArgs(args), where: f.path, group: resolveGroup(first), text: args.replace(/\s+/g, " ") });
    }
  }
  return uses;
}

function declaredIndexes(): Array<{ collectionGroup: string; queryScope?: string; fields: IndexField[] }> {
  const file = JSON.parse(readFileSync(join(root, "firestore.indexes.json"), "utf8")) as { indexes?: Array<{ collectionGroup: string; queryScope?: string; fields: IndexField[] }> };
  return file.indexes ?? [];
}

/* ── the checks ────────────────────────────────────────────────────────── */

const group = (uses: Use[]) => {
  const by = new Map<string, Set<string>>();
  for (const u of uses) by.set(u.pattern, (by.get(u.pattern) ?? new Set()).add(u.where));
  return by;
};
const report = (label: string, missing: Map<string, Set<string>>) => `${label} without an explicit rule block:\n${[...missing].map(([p, w]) => `  ${p}  ← ${[...w].join(", ")}`).join("\n")}`;

describe("rules coverage", () => {
  it("scans a meaningful number of paths (the extractors still match the code)", () => {
    const fs = group(firestoreUses());
    const rt = group(rtdbUses([]));
    // RULES_COVERAGE_PRINT=1 pnpm test tests/unit/rules-coverage.test.ts → the full inventory.
    if (process.env.RULES_COVERAGE_PRINT) console.log(`Firestore (${fs.size}): ${[...fs.keys()].sort().join(", ")}\nRTDB (${rt.size}): ${[...rt.keys()].sort().join(", ")}`);
    expect(fs.size).toBeGreaterThanOrEqual(25);
    expect(rt.size).toBeGreaterThanOrEqual(15);
    expect(fs.has("messages")).toBe(true);
    expect(fs.has("lists/*/items")).toBe(true);
    expect(fs.has("capsules/*/private")).toBe(true);
    expect(rt.has("presence")).toBe(true);
    expect(rt.has("whiteboard")).toBe(true); // only reachable through `${base}` + a JSX prop
    expect(rt.has("watch")).toBe(true); // `${kind}/main` through a union type
  });

  it("every Firestore collection the client touches has a match block", () => {
    const covered = firestoreCovered();
    const missing = new Map([...group(firestoreUses())].filter(([p]) => !covered.has(p)));
    expect(missing.size, report("Firestore collections", missing)).toBe(0);
  });

  it("every RTDB top-level node the client touches has a rules entry", () => {
    const unresolved: string[] = [];
    const uses = rtdbUses(unresolved);
    expect(unresolved, `RTDB paths starting with a variable this scan can't resolve:\n  ${unresolved.join("\n  ")}`).toEqual([]);
    const covered = rtdbCovered();
    const missing = new Map([...group(uses)].filter(([p]) => !covered.has(p)));
    expect(missing.size, report("RTDB nodes", missing)).toBe(0);
  });
});

describe("firestore composite indexes", () => {
  const spec = (args: string) => requiredIndex(parseQueryArgs(args))?.fields ?? null;
  const asc = (fieldPath: string): IndexField => ({ fieldPath, order: "ASCENDING" });
  const desc = (fieldPath: string): IndexField => ({ fieldPath, order: "DESCENDING" });

  it("knows which shapes the built-in indexes serve", () => {
    expect(spec('col(), orderBy("createdAt", "desc"), limit(50)')).toBeNull();
    expect(spec('col(), where("a", "==", 1), where("b", "==", null), limit(9)')).toBeNull();
    expect(spec('col(), where("dateKey", ">=", "x"), where("dateKey", "<=", "y"), limit(70)')).toBeNull();
    expect(spec('col(), where("d", ">", 1), orderBy("d"), limit(5)')).toBeNull();
    expect(spec('col(), orderBy(documentId()), startAt(a), endBefore(b), limit(60)')).toBeNull();
    expect(spec('col(), limit(100)')).toBeNull();
  });

  it("knows which shapes need a composite index, and spells it out", () => {
    expect(spec('col(), where("a", "==", 1), orderBy("createdAt", "desc")')).toEqual([asc("a"), desc("createdAt")]);
    expect(spec('col(), where("b", "==", 1), where("a", "==", 2), where("d", ">", 3)')).toEqual([asc("a"), asc("b"), asc("d")]);
    expect(spec('col(), where("d", ">", 3), orderBy("other")')).toEqual([asc("other"), asc("d")]);
    expect(spec('col(), orderBy("a"), orderBy("b", "desc")')).toEqual([asc("a"), desc("b")]);
    expect(spec('col(), where("x", ">", 1), where("y", "<", 2)')).toEqual([asc("x"), asc("y")]);
    expect(spec('col(), where("tags", "array-contains", "t"), orderBy("at", "desc")')).toEqual([{ fieldPath: "tags", arrayConfig: "CONTAINS" }, desc("at")]);
    expect(spec('col(), orderBy(documentId(), "desc"), limit(60)')).toEqual([desc("__name__")]);
  });

  it("reports filters it can't read instead of guessing", () => {
    expect(parseQueryArgs('col(), where(field, "==", 1), orderBy(sortKey)').unresolved).toEqual(['where(field, "==", 1)', "orderBy(sortKey)"]);
  });

  it("matches a declared index with equality fields in any order", () => {
    const need = [asc("a"), asc("b"), desc("createdAt")];
    expect(indexServes([asc("b"), asc("a"), desc("createdAt")], need, 2)).toBe(true);
    expect(indexServes([asc("a"), desc("createdAt"), asc("b")], need, 2)).toBe(false);
    expect(indexServes([asc("a"), asc("b"), asc("createdAt")], need, 2)).toBe(false);
  });

  it("scans the client's Firestore queries and resolves every collection and field", () => {
    const uses = firestoreQueries();
    if (process.env.RULES_COVERAGE_PRINT) console.log(uses.map((u) => `${u.group ?? "?"}  ${u.text}  ← ${u.where}`).join("\n"));
    expect(uses.length).toBeGreaterThanOrEqual(25);
    expect(uses.some((u) => u.group === "wordle" && u.orderBy[0]?.fieldPath === "__name__")).toBe(true);
    expect(uses.some((u) => u.group === "items")).toBe(true); // lists/{kind}/items through a helper
    expect(uses.some((u) => u.group === "trivia")).toBe(true); // helper taking the db as an argument
    const unresolved = uses.filter((u) => u.group === null || u.unresolved.length).map((u) => `${u.where}: ${u.group === null ? "collection?" : u.unresolved.join(", ")}  query(${u.text})`);
    expect(unresolved, `Firestore queries this scan can't judge:\n  ${unresolved.join("\n  ")}`).toEqual([]);
  });

  it("every query that needs a composite index has it in firestore.indexes.json", () => {
    const declared = declaredIndexes();
    const missing: string[] = [];
    for (const u of firestoreQueries()) {
      const need = requiredIndex(u);
      if (!need || !u.group) continue;
      if (need.fields.some((f) => f.fieldPath === "__name__" && f.order === "DESCENDING")) {
        missing.push(`${u.where}: query(${u.text})\n    orders by document id descending, which needs a __name__ DESC index — order ascending over an id range instead`);
        continue;
      }
      const served = declared.some((d) => d.collectionGroup === u.group && (d.queryScope ?? "COLLECTION") === "COLLECTION" && indexServes(d.fields, need.fields, need.equalityCount));
      if (!served) missing.push(`${u.where}: query(${u.text})\n    add to firestore.indexes.json: ${JSON.stringify({ collectionGroup: u.group, queryScope: "COLLECTION", fields: need.fields })}`);
    }
    expect(missing, `Firestore queries without a composite index:\n  ${missing.join("\n  ")}`).toEqual([]);
  });
});
