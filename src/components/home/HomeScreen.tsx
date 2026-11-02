"use client";

import { useSearchParams } from "next/navigation";
import { Fragment, useState, type ReactNode } from "react";

import { CountdownCard } from "@/components/home/CountdownCard";
import { DailyQuestionCard } from "@/components/home/DailyQuestionCard";
import { DigestCard } from "@/components/home/DigestCard";
import { GameInvitesCard } from "@/components/home/GameInvitesCard";
import { Lamps } from "@/components/home/Lamps";
import { LastMessageCard } from "@/components/home/LastMessageCard";
import { MilestoneBanner } from "@/components/home/MilestoneBanner";
import { MoodCheckin } from "@/components/home/MoodCheckin";
import { NextUpCard } from "@/components/home/NextUpCard";
import { OnThisDayCard } from "@/components/home/OnThisDayCard";
import { PetWidget } from "@/components/home/PetWidget";
import { PingOverlay } from "@/components/home/PingOverlay";
import { PingRow } from "@/components/home/PingRow";
import { PresenceCard } from "@/components/home/PresenceCard";
import { PushNudgeCard } from "@/components/home/PushNudgeCard";
import { SleepToggle } from "@/components/home/SleepToggle";
import { SnapCard } from "@/components/home/SnapCard";
import { StreakPlant } from "@/components/home/StreakPlant";
import { WaitingCard } from "@/components/home/WaitingCard";
import { useLiveEvents } from "@/components/live/LiveEventsProvider";
import { useHeader } from "@/components/shell/HeaderProvider";
import { SnapTakeover } from "@/components/snap/SnapTakeover";
import { Splash } from "@/components/ui/Splash";
import { useChatMeta } from "@/hooks/useChatMeta";
import { useHomeData, type HomeData } from "@/hooks/useHomeData";
import { useMilestoneDay } from "@/hooks/useMilestoneDay";
import { useNow } from "@/hooks/useNow";
import { usePair } from "@/hooks/usePair";
import { useRelationship } from "@/hooks/useRelationship";
import { useSnapToday } from "@/hooks/useSnapToday";
import { isMyMove } from "@/lib/db/games";
import { homeCardOrder, type HomeCardId } from "@/lib/homeCards";
import { homeDigestInput } from "@/lib/homeDigest";
import { readPref, writePref } from "@/lib/localPref";
import { yearsLine } from "@/lib/milestones";
import { SNAP_DISMISS_KEY, snapCardState, snapPinned, snapTakeoverDue } from "@/lib/snap";

export function HomeScreen() {
  const { me, friend, friendUid, pair } = usePair();
  useHeader({ emoji: "🥫", title: `Hi, ${me.nickname}` });
  const data = useHomeData();
  const { ping: activePing, dismissPing } = useLiveEvents();
  // The "Ping" home-screen shortcut opens /?ping=1: scroll the ping row in and glow it.
  const pingShortcut = useSearchParams().get("ping") === "1";

  if (pair.uids.length < 2 || !friendUid) {
    return (
      <div className="flex flex-col gap-4">
        <WaitingCard />
        <PushNudgeCard />
        <DailyQuestionCard today={data.today} friendUid={null} friendName={null} />
        <MoodCheckin myToday={data.myToday} myMood={data.myMood} friendMood={null} friendName={null} />
        <CountdownCard pair={pair} today={data.today} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <MilestoneBanner />
      <Cards data={data} friendUid={friendUid} pingShortcut={pingShortcut} />
      <SleepToggle />
      <PingOverlay ping={activePing} fromName={friend?.nickname ?? "Your friend"} onDone={dismissPing} />
    </div>
  );
}

/**
 * The cards in the order More → Home layout saved (`users/{me}.homeCards`,
 * `lib/homeCards.homeCardOrder`), with the pinned-to-top rule on top: the
 * snap card first while it's my move to post, then a game waiting on my move.
 */
function Cards({ data, friendUid, pingShortcut }: { data: HomeData; friendUid: string; pingShortcut: boolean }) {
  const { uid, me, friend, pair, loading } = usePair();
  const { games, daily } = useLiveEvents();
  const { unreadCount } = useChatMeta();
  const milestoneDay = useMilestoneDay();
  const preset = useRelationship();
  const party = milestoneDay.milestones.length > 0;
  const now = useNow(30_000).getTime();
  const snapSummary = useSnapToday(data.today);
  // The digest's "since" point is read once per Home mount, so moving lastOpenAt forward doesn't empty the card under the reader.
  const [sinceMs] = useState<number | null>(() => me.lastOpenAt?.toMillis?.() ?? null);
  // Today's snap prompt: shown until posted or dismissed on this device (localStorage by room day).
  const [dismissedFor, setDismissedFor] = useState<string | null>(() => readPref(SNAP_DISMISS_KEY));

  if (loading || !friend) return <Splash label="Finding your friend…" inline />;

  const snapState = snapCardState(pair.snap, snapSummary, uid, friendUid, data.today, now);
  const myTurn = games.filter((g) => isMyMove(g, uid)).length;
  const invites = games.filter((g) => g.status === "invited" && g.createdBy !== uid).length;
  const order = homeCardOrder(me.homeCards, { snap: snapPinned(snapState), games: myTurn > 0 });
  const takeover = snapTakeoverDue({ schedule: pair.snap, summary: snapSummary, uid, today: data.today, now, dismissedFor });
  const digestInput = homeDigestInput({
    uid,
    friendUid,
    sinceMs,
    now,
    today: data.today,
    unread: unreadCount,
    snapSummary,
    schedule: pair.snap,
    friendNote: friend.note,
    daily,
    myTurn,
    invites,
    jar: pair.jar,
    milestonesToday: milestoneDay.milestones.map((m) => (m.derived && m.years !== null ? yearsLine(m.years, preset.pairNoun) : m.title)),
    pet: pair.pet,
    eventAdded: pair.eventAdded,
  });

  const cards: Record<HomeCardId, ReactNode> = {
    digest: <DigestCard uid={uid} friendName={friend.nickname} input={digestInput} sinceMs={sinceMs} now={now} />,
    presence: <PresenceCard friend={friend} />,
    snap: <SnapCard state={snapState} schedule={pair.snap} summary={snapSummary} uid={uid} friendUid={friendUid} friendName={friend.nickname} />,
    chatPreview: <LastMessageCard friendName={friend.nickname} />,
    games: (
      <>
        <GameInvitesCard friendName={friend.nickname} />
        <PushNudgeCard />
      </>
    ),
    pings: <PingRow friendUid={friendUid} friendName={friend.nickname} highlight={pingShortcut} />,
    lamp: <Lamps friendUid={friendUid} friendName={friend.nickname} />,
    dailyQuestion: <DailyQuestionCard today={data.today} friendUid={friendUid} friendName={friend.nickname} party={party} />,
    mood: <MoodCheckin myToday={data.myToday} myMood={data.myMood} friendMood={data.friendMood} friendName={friend.nickname} />,
    onThisDay: <OnThisDayCard today={data.today} />,
    streakPlant: <StreakPlant today={data.today} checkins={data.checkins} friendUid={friendUid} friendName={friend.nickname} />,
    pet: <PetWidget />,
    countdown: <CountdownCard pair={pair} today={data.today} />,
    nextUp: <NextUpCard today={data.today} />,
  };

  return (
    <>
      {takeover && (
        <SnapTakeover
          today={data.today}
          uid={uid}
          friendName={friend.nickname}
          friendPosted={Boolean(snapSummary?.posted?.[friendUid])}
          onPosted={() => undefined}
          onDismiss={() => {
            writePref(SNAP_DISMISS_KEY, data.today);
            setDismissedFor(data.today);
          }}
        />
      )}
      {order.map((id) => (
        <Fragment key={id}>{cards[id]}</Fragment>
      ))}
    </>
  );
}
