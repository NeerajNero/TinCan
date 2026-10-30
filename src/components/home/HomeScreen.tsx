"use client";

import { useSearchParams } from "next/navigation";

import { CountdownCard } from "@/components/home/CountdownCard";
import { DailyQuestionCard } from "@/components/home/DailyQuestionCard";
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
import { StreakPlant } from "@/components/home/StreakPlant";
import { WaitingCard } from "@/components/home/WaitingCard";
import { useLiveEvents } from "@/components/live/LiveEventsProvider";
import { Splash } from "@/components/ui/Splash";
import { useHomeData } from "@/hooks/useHomeData";
import { useMilestoneDay } from "@/hooks/useMilestoneDay";
import { usePair } from "@/hooks/usePair";

function Header({ nickname }: { nickname: string }) {
  return (
    <header className="flex items-center gap-3 px-1">
      <span className="text-4xl" aria-hidden>
        🥫
      </span>
      <div>
        <h1 className="text-3xl font-semibold">Hi, {nickname}</h1>
      </div>
    </header>
  );
}

export function HomeScreen() {
  const { me, friend, friendUid, pair, loading } = usePair();
  const data = useHomeData();
  const { ping: activePing, dismissPing } = useLiveEvents();
  const party = useMilestoneDay().milestones.length > 0;
  // The "Ping" home-screen shortcut opens /?ping=1: scroll the ping row in and glow it.
  const pingShortcut = useSearchParams().get("ping") === "1";

  if (pair.uids.length < 2 || !friendUid) {
    return (
      <div className="flex flex-col gap-4">
        <Header nickname={me.nickname} />
        <WaitingCard />
        <PushNudgeCard />
        <DailyQuestionCard today={data.today} friendUid={null} friendName={null} />
        <MoodCheckin myToday={data.myToday} myMood={data.myMood} friendMood={null} friendName={null} />
        <CountdownCard pair={pair} today={data.today} />
      </div>
    );
  }

  if (loading || !friend) return <Splash label="Finding your friend…" inline />;

  return (
    <div className="flex flex-col gap-4">
      <Header nickname={me.nickname} />
      <MilestoneBanner />
      <PresenceCard friend={friend} />
      <LastMessageCard friendName={friend.nickname} />
      <GameInvitesCard friendName={friend.nickname} />
      <PushNudgeCard />
      <PingRow friendUid={friendUid} friendName={friend.nickname} highlight={pingShortcut} />
      <Lamps friendUid={friendUid} friendName={friend.nickname} />
      <DailyQuestionCard today={data.today} friendUid={friendUid} friendName={friend.nickname} party={party} />
      <MoodCheckin myToday={data.myToday} myMood={data.myMood} friendMood={data.friendMood} friendName={friend.nickname} />
      <OnThisDayCard today={data.today} />
      <StreakPlant today={data.today} checkins={data.checkins} friendUid={friendUid} friendName={friend.nickname} />
      <PetWidget />
      <CountdownCard pair={pair} today={data.today} />
      <NextUpCard today={data.today} />
      <SleepToggle />
      <PingOverlay ping={activePing} fromName={friend.nickname} onDone={dismissPing} />
    </div>
  );
}
