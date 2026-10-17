import { systemLine } from "@/lib/chat/systemKinds";
import type { Message } from "@/lib/types";

/**
 * A centred system line. Always has content: its text, else a line derived
 * from kind + meta, else ✨ — so a row never renders as an empty gap. `relative`
 * keeps it painted above the chat background layer.
 */
export function SystemPill({ message }: { message: Pick<Message, "text" | "kind" | "meta"> }) {
  return (
    <p role="note" className="relative mx-auto max-w-[90%] rounded-full bg-surface px-3 py-1 text-center text-xs font-semibold text-muted shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
      {systemLine(message)}
    </p>
  );
}
