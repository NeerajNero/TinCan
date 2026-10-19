/**
 * Daily-word definitions, served as static files `public/words/{a..z}.json` built by
 * `pnpm words:definitions` (WordNet + `content/word-definitions-manual.json`). Nothing is loaded
 * until the player asks: one letter file (≤ 35 KB) per lookup, cached in memory for the session
 * and by the service worker like any other same-origin asset.
 */
export interface WordDefinition {
  /** Part of speech, lower case ("noun", "verb", "adjective", …). */
  pos: string;
  /** One line, ≤ 120 chars, lower-case start. */
  meaning: string;
  /** Optional usage example, ≤ 120 chars. */
  example?: string;
}

type LetterFile = Record<string, WordDefinition>;

/** `/words/a.json` for "acorn"; null for anything that isn't a lower-case a–z word. */
export function definitionUrl(word: string): string | null {
  const letter = word.toLowerCase()[0];
  return letter !== undefined && /^[a-z]$/.test(letter) ? `/words/${letter}.json` : null;
}

const files = new Map<string, Promise<LetterFile>>();

/** Resolves the definition of `word`, or null when the letter file has no entry. Rejects on a network error. */
export function fetchDefinition(word: string, fetchFn: typeof fetch = fetch): Promise<WordDefinition | null> {
  const url = definitionUrl(word);
  if (url === null) return Promise.resolve(null);
  let file = files.get(url);
  if (!file) {
    file = fetchFn(url).then((res) => {
      if (!res.ok) throw new Error(`definitions_${res.status}`);
      return res.json() as Promise<LetterFile>;
    });
    file.catch(() => files.delete(url)); // a failed load is retried on the next tap
    files.set(url, file);
  }
  return file.then((map) => map[word.toLowerCase()] ?? null);
}

/** "ACORN · noun" — the heading line of a reveal. */
export const definitionHeading = (word: string, def: WordDefinition) => `${word.toUpperCase()} · ${def.pos}`;
