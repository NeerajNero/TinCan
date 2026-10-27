"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { APP_BUILD, getUpdateController, type CheckResult } from "@/lib/swUpdate";

const RESULT_TEXT: Record<CheckResult, string> = {
  waiting: "Update available — tap Reload at the top",
  none: "You're up to date",
  unavailable: "Updates are checked by the installed app",
};

/** More → app build + a manual update check (the toast at the top offers the reload). */
export function UpdateCard() {
  const [checking, setChecking] = useState(() => getUpdateController().state().checking);
  const [result, setResult] = useState<CheckResult | null>(null);

  useEffect(() => getUpdateController().subscribe((s) => setChecking(s.checking)), []);

  async function check() {
    setResult(null);
    setResult(await getUpdateController().check({ force: true }));
  }

  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-xl" aria-hidden>
        🚀
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold leading-tight">App build</h2>
        <p className="font-mono text-xs text-muted">{APP_BUILD}</p>
        {result && (
          <p className="text-xs text-muted" role="status">
            {RESULT_TEXT[result]}
          </p>
        )}
      </div>
      <Button variant="soft" onClick={() => void check()} disabled={checking} className="shrink-0 px-3 py-2 text-sm">
        <RefreshCw size={16} aria-hidden className={checking ? "animate-spin" : undefined} />
        {checking ? "Checking…" : "Check for updates"}
      </Button>
    </Card>
  );
}
