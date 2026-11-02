"use client";

import { FriendHereBadge } from "@/components/play/FriendHereBadge";
import { InviteButton, type InviteSpec } from "@/components/play/InviteButton";
import { useHeader } from "@/components/shell/HeaderProvider";
import type { HowToKey } from "@/content/howto";

interface SubHeaderProps {
  emoji: string;
  title: string;
  /** Where Back lands when this session has no in-app history to pop. */
  back?: string;
  action?: React.ReactNode;
  /** Shows the friend-here line in the subtitle slot. */
  screenName?: string;
  help?: HowToKey;
  /** Adds "Invite" and gives the friend-here line its compact Invite (phase 21). */
  invite?: InviteSpec;
  /** Replaces the friend-here line (a game's turn status). */
  subtitle?: React.ReactNode;
}

/**
 * A sub-screen's header, declared onto the persistent app header (chore:
 * persistent app header): back arrow, emoji, title, actions (+ Invite), the ?
 * button, and the friend-here badge (or a custom subtitle) under the title.
 * Renders nothing in place.
 */
export function SubHeader({ emoji, title, back = "/memories", action, screenName, help, invite, subtitle }: SubHeaderProps) {
  useHeader({
    emoji,
    title,
    back,
    help,
    actions: (
      <>
        {action}
        {invite && <InviteButton spec={invite} />}
      </>
    ),
    subtitle: subtitle ?? (screenName ? <FriendHereBadge invite={invite} /> : undefined),
  });
  return null;
}
