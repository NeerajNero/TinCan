"use client";

import { Eraser, Pen, Undo2 } from "lucide-react";
import { useCallback, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { CANVAS_COLORS, CANVAS_WIDTHS, SharedCanvas, type Tool } from "@/components/play/together/SharedCanvas";
import { Button } from "@/components/ui/Button";
import { usePair } from "@/hooks/usePair";
import { cn } from "@/lib/cn";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { sendMedia } from "@/lib/db/messages";
import { clearStrokes } from "@/lib/db/together";
import { recordTogetherEvent } from "@/lib/garden";
import { notify } from "@/lib/notify";

export function WhiteboardScreen() {
  const { uid, friendUid } = usePair();
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>(CANVAS_COLORS[0]);
  const [width, setWidth] = useState<number>(CANVAS_WIDTHS[1]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [ctl, setCtl] = useState<{ undo: () => void; toPng: () => Promise<Blob | null>; count: number } | null>(null);
  const controls = useCallback((c: { undo: () => void; toPng: () => Promise<Blob | null>; count: number }) => setCtl(c), []);

  async function snapshot() {
    if (!ctl || snapping) return;
    setSnapping(true);
    try {
      const blob = await ctl.toPng();
      if (!blob) return;
      const up = await uploadToCloudinary(blob, { kind: "image" });
      const id = await sendMedia(uid, "image", { url: up.url, publicId: up.publicId, w: up.w ?? 800, h: up.h ?? 800, bytes: up.bytes }, "🖍️ Whiteboard snapshot");
      if (friendUid) void notify("message", { toUid: friendUid, body: "📷 Whiteboard snapshot", data: { messageId: id } });
    } finally {
      setSnapping(false);
    }
  }

  return (
    <div className="-mb-6 flex min-h-0 flex-1 flex-col gap-3">
      <SubHeader
        emoji="🖍️"
        title="Whiteboard"
        back="/play"
        action={
          <Button variant="soft" onClick={snapshot} disabled={snapping || !ctl || ctl.count === 0} className="px-3 py-2 text-sm">
            {snapping ? "Sending…" : "Snapshot"}
          </Button>
        }
      />
      <SharedCanvas base="whiteboard" canDraw tool={tool} color={color} width={width} cursors page="/play/whiteboard" controls={controls} onFirstStroke={() => recordTogetherEvent("whiteboard")} />
      <div className="card flex flex-col gap-2 rounded-[20px] p-2">
        <div className="flex items-center gap-1">
          <ToolBtn active={tool === "pen"} onClick={() => setTool("pen")} label="Pen">
            <Pen size={18} />
          </ToolBtn>
          <ToolBtn active={tool === "eraser"} onClick={() => setTool("eraser")} label="Eraser">
            <Eraser size={18} />
          </ToolBtn>
          <span className="mx-1 h-6 w-px bg-border" />
          {CANVAS_WIDTHS.map((w) => (
            <button key={w} type="button" onClick={() => setWidth(w)} aria-label={`Width ${w}`} aria-pressed={width === w} className={cn("tap grid size-10 place-items-center rounded-full", width === w && "bg-accent-soft")}>
              <span className="rounded-full bg-text" style={{ width: w + 4, height: w + 4 }} />
            </button>
          ))}
          <span className="flex-1" />
          <ToolBtn onClick={() => ctl?.undo()} label="Undo my last stroke">
            <Undo2 size={18} />
          </ToolBtn>
          {!confirmClear ? (
            <button type="button" onClick={() => setConfirmClear(true)} className="tap rounded-full px-3 text-sm font-bold text-muted">
              Clear
            </button>
          ) : (
            <span className="flex items-center gap-1">
              <button type="button" onClick={() => setConfirmClear(false)} className="tap rounded-full px-2 text-xs font-bold text-muted">
                Keep
              </button>
              <button type="button" onClick={() => { void clearStrokes("whiteboard"); setConfirmClear(false); }} className="tap rounded-full bg-red-500 px-3 text-xs font-bold text-white">
                Clear all
              </button>
            </span>
          )}
        </div>
        <div role="radiogroup" aria-label="Colour" className="flex items-center justify-between gap-1 px-1">
          {CANVAS_COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={color === c && tool === "pen"} aria-label={c} onClick={() => { setColor(c); setTool("pen"); }} className={cn("tap grid place-items-center rounded-full", color === c && tool === "pen" && "ring-2 ring-text ring-offset-2 ring-offset-surface")}>
              <span className="block size-7 rounded-full" style={{ background: c }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ToolBtn({ active, onClick, label, children }: { active?: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={active} className={cn("tap grid size-10 place-items-center rounded-full text-text", active ? "bg-accent-soft" : "hover:bg-surface-2")}>
      {children}
    </button>
  );
}
