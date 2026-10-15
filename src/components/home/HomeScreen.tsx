"use client";

import { useCallback, useState } from "react";

import { CountdownCard } from "@/components/home/CountdownCard";
import { Lamps } from "@/components/home/Lamps";
import { MoodCheckin } from "@/components/home/MoodCheckin";
import { PingOverlay } from "@/components/home/PingOverlay";
import { PingRow } from "@/components/home/PingRow";
import { PresenceCard } from "@/components/home/PresenceCard";
import { SleepToggle } from "@/components/home/SleepToggle";
import { StreakPlant } from "@/components/home/StreakPlant";
import { WaitingCard } from "@/components/home/WaitingCard";
import { Splash } from "@/components/ui/Splash";
import { useHomeData } from "@/hooks/useHomeData";
import { useIncomingPings, type IncomingPing } from "@/hooks/useIncomingPings";
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
  const { uid, me, friend, friendUid, pair, loading } = usePair();
  const data = useHomeData();
  const incoming = useIncomingPings(uid);
  const [dismissed, setDismissed] = useState<IncomingPing | null>(null);
  const dismiss = useCallback(() => setDismissed(incoming), [incoming]);
  const activePing = incoming && incoming !== dismissed ? incoming : null;

  if (pair.uids.length < 2 || !friendUid) {
    return (
      <div className="flex flex-col gap-4">
        <Header nickname={me.nickname} />
        <WaitingCard />
        <MoodCheckin myToday={data.myToday} myMood={data.myMood} friendMood={null} friendName={null} />
        <CountdownCard meetup={pair.nextMeetup} today={data.today} />
      </div>
    );
  }

  if (loading || !friend) return <Splash label="Finding your friend…" />;

  return (
    <div className="flex flex-col gap-4">
      <Header nickname={me.nickname} />
      <PresenceCard friend={friend} />
      <PingRow friendUid={friendUid} friendName={friend.nickname} />
      <Lamps friendUid={friendUid} friendName={friend.nickname} />
      <MoodCheckin myToday={data.myToday} myMood={data.myMood} friendMood={data.friendMood} friendName={friend.nickname} />
      <StreakPlant today={data.today} checkins={data.checkins} friendUid={friendUid} friendName={friend.nickname} />
      <CountdownCard meetup={pair.nextMeetup} today={data.today} />
      <SleepToggle />
      <PingOverlay ping={activePing} fromName={friend.nickname} onDone={dismiss} />
    </div>
  );
}
