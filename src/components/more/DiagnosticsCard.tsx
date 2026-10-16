"use client";

import { ChevronDown, Copy } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { useNow } from "@/hooks/useNow";
import { useRtdbValue } from "@/hooks/useRtdbValue";
import { cn } from "@/lib/cn";
import { pairRef } from "@/lib/db/refs";
import { diagEntries, type DiagEntry } from "@/lib/diagLog";
import { rtdbPrefersLongPolling } from "@/lib/firebase/client";
import { onSnapshot } from "@/lib/firebase/fs";
import { getFirestoreHealth, subscribeFirestoreHealth, type FirestoreHealth } from "@/lib/firestoreHealth";

/** Owner-only troubleshooting panel. Listeners exist only while it's open. */
export function DiagnosticsCard() {
  const { isOwner } = useAuth();
  const [open, setOpen] = useState(false);
  if (!isOwner) return null;
  return (
    <Card className="flex flex-col gap-3">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="tap flex items-center justify-between text-left">
        <span>
          <span className="block text-lg font-semibold">Diagnostics</span>
          <span className="block text-sm text-muted">Connection, worker and error details for this device</span>
        </span>
        <ChevronDown size={18} className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && <DiagnosticsPanel />}
    </Card>
  );
}

interface WorkerInfo {
  controller: boolean;
  active: string;
  waiting: boolean;
  installing: boolean;
  build: string;
}

interface Connection {
  effectiveType?: string;
  type?: string;
  downlink?: number;
  saveData?: boolean;
}

const fmtAge = (ms: number) => (ms < 60_000 ? `${Math.round(ms / 1000)} s` : ms < 3_600_000 ? `${Math.round(ms / 60_000)} min` : `${(ms / 3_600_000).toFixed(1)} h`);

function fmtHealth(h: FirestoreHealth, now: number): string {
  if (h.online === null) return "no snapshot yet";
  const times = h.offlineCount === 1 ? "once" : `${h.offlineCount} times`;
  const parts = [`went offline ${times} this session`];
  if (h.lastOfflineAt !== null) parts.push(`last ${fmtAge(now - h.lastOfflineAt)} ago`);
  if (h.offlineMs > 0) parts.push(`${fmtAge(h.offlineMs)} offline in total`);
  if (h.online === false) parts.push("offline now");
  return parts.join(", ");
}

async function workerInfo(): Promise<WorkerInfo> {
  if (!("serviceWorker" in navigator)) return { controller: false, active: "unsupported", waiting: false, installing: false, build: "—" };
  const reg = await navigator.serviceWorker.getRegistration("/").catch(() => undefined);
  const target = navigator.serviceWorker.controller ?? reg?.active ?? null;
  const build = target
    ? await new Promise<string>((resolve) => {
        const ch = new MessageChannel();
        const t = setTimeout(() => resolve("no answer (older worker?)"), 1500);
        ch.port1.onmessage = (e) => {
          clearTimeout(t);
          resolve(String((e.data as { build?: string }).build ?? "?"));
        };
        target.postMessage({ type: "VERSION" }, [ch.port2]);
      })
    : "—";
  return { controller: Boolean(navigator.serviceWorker.controller), active: reg?.active?.state ?? "none", waiting: Boolean(reg?.waiting), installing: Boolean(reg?.installing), build };
}

async function cspMode(): Promise<string> {
  try {
    const res = await fetch(window.location.pathname, { method: "HEAD", cache: "no-store" });
    if (res.headers.get("content-security-policy")) return "enforced";
    if (res.headers.get("content-security-policy-report-only")) return "report-only (CSP_REPORT_ONLY=1)";
    return "none";
  } catch {
    return "unknown (offline?)";
  }
}

function DiagnosticsPanel() {
  const { user } = useAuth();
  const now = useNow(2000);
  const { value: connected, loaded: rtdbLoaded } = useRtdbValue<boolean>(".info/connected");
  const { value: offset } = useRtdbValue<number>(".info/serverTimeOffset");
  const [fs, setFs] = useState<{ fromCache: boolean; pending: boolean; at: number } | null>(null);
  const [fsError, setFsError] = useState<string | null>(null);
  const [worker, setWorker] = useState<WorkerInfo | null>(null);
  const [csp, setCsp] = useState("checking…");
  const [token, setToken] = useState<{ issuedAt: number; expiresAt: number } | null>(null);
  const [log, setLog] = useState<readonly DiagEntry[]>(() => diagEntries());
  const health = useSyncExternalStore(subscribeFirestoreHealth, getFirestoreHealth, getFirestoreHealth);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      pairRef(),
      { includeMetadataChanges: true },
      (snap) => setFs({ fromCache: snap.metadata.fromCache, pending: snap.metadata.hasPendingWrites, at: Date.now() }),
      (err) => setFsError(`${err.code}: ${err.message}`.slice(0, 200)),
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    let live = true;
    void workerInfo().then((w) => live && setWorker(w));
    void cspMode().then((c) => live && setCsp(c));
    void user?.getIdTokenResult().then((r) => live && setToken({ issuedAt: Date.parse(r.issuedAtTime), expiresAt: Date.parse(r.expirationTime) }));
    const t = setInterval(() => setLog(diagEntries()), 2000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [user]);

  const conn = (navigator as Navigator & { connection?: Connection }).connection;
  const firestoreLast = log.filter((e) => /firestore/i.test(e.text)).at(-1);
  const rows: Array<[string, string]> = [
    ["App build", process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"],
    ["Worker", worker ? `${worker.active}${worker.controller ? ", controlling" : ", not controlling"}${worker.waiting ? ", update waiting" : ""}${worker.installing ? ", installing" : ""}` : "checking…"],
    ["Worker build", worker?.build ?? "checking…"],
    ["Auth uid", user?.uid ?? "signed out"],
    ["ID token age", token ? `${fmtAge(now.getTime() - token.issuedAt)} (expires in ${fmtAge(Math.max(0, token.expiresAt - now.getTime()))})` : "—"],
    ["RTDB connected", rtdbLoaded ? String(connected === true) : "waiting for first value"],
    ["RTDB transport", rtdbPrefersLongPolling() ? "long-polling first (a WebSocket failed this session)" : "WebSocket first"],
    ["RTDB server offset", typeof offset === "number" ? `${Math.round(offset)} ms` : "—"],
    ["Firestore", fs ? `${fs.fromCache ? "offline (from cache)" : "online"}${fs.pending ? ", writes pending" : ""}, updated ${fmtAge(now.getTime() - fs.at)} ago` : "waiting…"],
    ["Firestore reconnects", fmtHealth(health, now.getTime())],
    ["Firestore last error", fsError ?? firestoreLast?.text ?? "none"],
    ["CSP", csp],
    ["Network", `${navigator.onLine ? "online" : "offline"}${conn ? ` · ${conn.type ?? "?"} / ${conn.effectiveType ?? "?"}${conn.downlink ? ` · ${conn.downlink} Mb/s` : ""}${conn.saveData ? " · data saver" : ""}` : ""}`],
    ["Display", `${window.matchMedia("(display-mode: standalone)").matches ? "installed app" : "browser tab"} · ${window.innerWidth}×${window.innerHeight}`],
    ["User agent", navigator.userAgent],
  ];

  function asText() {
    const lines = [`Tincan diagnostics · ${new Date().toISOString()}`, ...rows.map(([k, v]) => `${k}: ${v}`), "", `Last ${log.length} errors:`];
    for (const e of log) lines.push(`${new Date(e.at).toISOString()} [${e.kind}] ${e.text}`);
    return lines.join("\n");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(asText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-bold text-muted">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Last {log.length} errors</p>
        {log.length === 0 ? (
          <p className="text-xs text-muted">Nothing logged on this device since the app opened 🎉</p>
        ) : (
          <ol className="flex max-h-60 flex-col gap-1 overflow-y-auto rounded-xl bg-surface-2 p-2 font-mono text-[10px] leading-snug">
            {log.map((e, i) => (
              <li key={i} className="break-words">
                <span className="text-muted">{new Date(e.at).toLocaleTimeString()} [{e.kind}]</span> {e.text}
              </li>
            ))}
          </ol>
        )}
      </div>
      <Button variant="soft" onClick={() => void copy()} className="self-start">
        <Copy size={16} aria-hidden />
        {copied ? "Copied ✓" : "Copy diagnostics"}
      </Button>
    </div>
  );
}
