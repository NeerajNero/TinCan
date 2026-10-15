import type { ReactNode } from "react";

const URL_RE = /((?:https?:\/\/|www\.)[^\s<]+?)(?=[.,;:!?)\]'"]*(?:\s|$))/gi;

/** Plain text with bare URLs turned into links. No previews, no unfurling. */
export function Linkify({ text }: { text: string }): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const url = match[0];
    if (start > last) parts.push(text.slice(last, start));
    const href = url.startsWith("http") ? url : `https://${url}`;
    parts.push(
      <a
        key={start}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-current/50 underline-offset-2 break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>,
    );
    last = start + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
