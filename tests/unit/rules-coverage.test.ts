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
