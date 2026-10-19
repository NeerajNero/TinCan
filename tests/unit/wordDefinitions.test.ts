import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import answers from "@/content/words-answers.json";
import { definitionHeading, definitionUrl, fetchDefinition, type WordDefinition } from "@/lib/wordDefinitions";

const dir = join(process.cwd(), "public/words");
const files = Object.fromEntries(readdirSync(dir).map((f) => [f, JSON.parse(readFileSync(join(dir, f), "utf8")) as Record<string, WordDefinition>]));
const all: Record<string, WordDefinition> = Object.assign({}, ...Object.values(files));

describe("word definitions (public/words)", () => {
  it("has one file per letter and nothing else", () => {
    expect(Object.keys(files).sort()).toEqual("abcdefghijklmnopqrstuvwxyz".split("").map((l) => `${l}.json`));
  });
  it("defines every daily-word answer, filed under its first letter", () => {
    const missing = (answers as string[]).filter((w) => !files[`${w[0]}.json`]?.[w]);
    expect(missing).toEqual([]);
  });
  it("keeps every entry short and well formed", () => {
    for (const [word, d] of Object.entries(all)) {
      expect(d.pos, word).toMatch(/^[a-z ]+$/);
      expect(d.meaning.length, word).toBeGreaterThan(0);
      expect(d.meaning.length, word).toBeLessThanOrEqual(120);
      if (d.example !== undefined) expect(d.example.length, word).toBeLessThanOrEqual(120);
    }
  });
  it("stays small enough to fetch on a phone", () => {
    for (const f of readdirSync(dir)) expect(readFileSync(join(dir, f)).byteLength, f).toBeLessThan(40 * 1024);
  });
});

describe("fetchDefinition", () => {
  it("maps a word to its letter file and rejects non-words", () => {
    expect(definitionUrl("Acorn")).toBe("/words/a.json");
    expect(definitionUrl("")).toBeNull();
    expect(definitionUrl("1abc")).toBeNull();
  });
  it("loads one letter file once and looks the word up", async () => {
    const calls: string[] = [];
    const fetchFn = ((url: string) => {
      calls.push(url);
      return Promise.resolve(new Response(JSON.stringify({ zebra: { pos: "noun", meaning: "striped equine" } }), { status: 200 }));
    }) as unknown as typeof fetch;
    expect(await fetchDefinition("zebra", fetchFn)).toEqual({ pos: "noun", meaning: "striped equine" });
    expect(await fetchDefinition("zesty", fetchFn)).toBeNull();
    expect(calls).toEqual(["/words/z.json"]);
  });
  it("formats the heading", () => {
    expect(definitionHeading("acorn", { pos: "noun", meaning: "x" })).toBe("ACORN · noun");
  });
});
