"use client";

import { format } from "date-fns";
import { useCallback } from "react";
import type { QueryDocumentSnapshot } from "@/lib/firebase/fs";

import { SubHeader } from "@/components/memories/SubHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { usePagedCollection } from "@/hooks/usePagedCollection";
import { usePair } from "@/hooks/usePair";
import { questionAt } from "@/lib/daily";
import { dateKeyToLocalDate } from "@/lib/dates";
import { historyQuery, HISTORY_PAGE } from "@/lib/db/daily";
import type { DailyQuestionDoc } from "@/lib/types";

interface Row extends DailyQuestionDoc {
  id: string;
}

const mapDoc = (d: QueryDocumentSnapshot<DailyQuestionDoc>): Row => ({ id: d.id, ...d.data() });
const byDateDesc = (a: Row, b: Row) => b.id.localeCompare(a.id);

export function QuestionsHistory() {
  const { uid, friend, friendUid } = usePair();
  const makeQuery = useCallback((after: QueryDocumentSnapshot<DailyQuestionDoc> | null) => historyQuery(after), []);
  const { items, ready, hasMore, loadingMore, loadMore } = usePagedCollection(makeQuery, HISTORY_PAGE, mapDoc, byDateDesc);

  return (
    <div className="flex flex-col gap-4">
      <SubHeader emoji="💭" title="Daily questions" />
      {!ready && <ListSkeleton tall />}
      {ready && items.length === 0 && <Card className="py-8 text-center text-muted">No answers yet — today&apos;s question is waiting on Home.</Card>}
      {items.map((row) => {
        const mine = row.answers?.[uid]?.text;
        const theirs = friendUid ? row.answers?.[friendUid]?.text : undefined;
        const revealTheirs = Boolean(mine) || !theirs;
        return (
          <Card key={row.id} className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{format(dateKeyToLocalDate(row.id), "EEE, d MMM yyyy")}</p>
            <p className="font-heading font-semibold leading-snug">{questionAt(row.questionIndex)}</p>
            <Answer who="You" text={mine} />
            <Answer who={friend?.nickname ?? "Friend"} text={revealTheirs ? theirs : undefined} hidden={!revealTheirs} />
          </Card>
        );
      })}
      {hasMore && (
        <Button variant="soft" onClick={loadMore} disabled={loadingMore} className="self-center">
          {loadingMore ? "Loading…" : "Load older"}
        </Button>
      )}
    </div>
  );
}

function Answer({ who, text, hidden }: { who: string; text?: string; hidden?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-2">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{who}</p>
      <p className={text ? "text-sm whitespace-pre-wrap" : "text-sm text-muted"}>{hidden ? "Answer that day's question to reveal" : (text ?? "No answer")}</p>
    </div>
  );
}
