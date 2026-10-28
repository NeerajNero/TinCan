"use client";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { activeTab, type TabKey } from "@/lib/tabs";

/**
 * The `loading.tsx` of every tab: a skeleton shaped like that tab so the shell
 * paints the moment the tap lands, while the page payload streams. Deeper
 * routes (a game, a list, the pet) get a generic sub-screen skeleton, since a
 * tab's `loading.tsx` also covers its children.
 */
export function TabLoading() {
  const pathname = usePathname();
  const tab = activeTab(pathname);
  const atRoot = pathname === tab.href;
  return (
    <div className="flex flex-1 flex-col gap-4" role="status" aria-label="Loading" aria-busy>
      {atRoot ? SKELETONS[tab.key] : <SubScreen />}
    </div>
  );
}

const Bone = ({ className, style }: { className?: string; style?: React.CSSProperties }) => <div className={cn("animate-pulse rounded-2xl bg-surface-2", className)} style={style} aria-hidden />;

const Header = ({ wide }: { wide?: boolean }) => (
  <div className="flex items-center gap-3 px-1">
    <Bone className="size-10 rounded-full" />
    <Bone className={cn("h-8", wide ? "w-40" : "w-28")} />
  </div>
);

const RowCard = () => (
  <div className="card flex items-center gap-4 rounded-[24px] px-4 py-3">
    <Bone className="size-12 shrink-0 rounded-full" />
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <Bone className="h-4 w-1/2" />
      <Bone className="h-3 w-3/4" />
    </div>
  </div>
);

const TileGrid = ({ tiles }: { tiles: number }) => (
  <div className="grid grid-cols-2 gap-3">
    {Array.from({ length: tiles }, (_, i) => (
      <div key={i} className="card flex flex-col gap-2 rounded-[24px] p-4">
        <Bone className="size-10 rounded-full" />
        <Bone className="h-5 w-2/3" />
        <Bone className="h-3 w-1/2" />
      </div>
    ))}
  </div>
);

const Home = (
  <>
    <Header wide />
    <div className="card flex items-center gap-3 rounded-[24px] p-4">
      <Bone className="size-14 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Bone className="h-5 w-1/2" />
        <Bone className="h-3 w-2/3" />
        <Bone className="h-3 w-1/3" />
      </div>
    </div>
    <div className="grid grid-cols-4 gap-3 px-1">
      {Array.from({ length: 4 }, (_, i) => (
        <Bone key={i} className="aspect-square rounded-[24px]" />
      ))}
    </div>
    <div className="card flex flex-col gap-3 rounded-[24px] p-4">
      <Bone className="h-4 w-1/3" />
      <Bone className="h-5 w-full" />
      <Bone className="h-11 w-full" />
    </div>
    <div className="card flex items-center gap-3 rounded-[24px] p-4">
      <Bone className="size-12 shrink-0 rounded-full" />
      <Bone className="h-4 w-1/2" />
    </div>
  </>
);

const Chat = (
  <div className="-mx-4 -mt-4 -mb-6 flex min-h-0 flex-1 flex-col">
    <div className="flex items-center gap-3 px-4 py-3">
      <Bone className="size-10 rounded-full" />
      <div className="flex flex-col gap-1.5">
        <Bone className="h-4 w-24" />
        <Bone className="h-3 w-16" />
      </div>
    </div>
    <div className="flex flex-1 flex-col justify-end gap-2 px-4 pb-3">
      {[56, 72, 44, 64, 80, 48].map((w, i) => (
        <Bone key={i} className={cn("h-10 rounded-[20px]", i % 2 ? "self-end" : "self-start")} style={{ width: `${w}%` }} />
      ))}
    </div>
    <div className="px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2">
      <Bone className="h-12 rounded-[24px]" />
    </div>
  </div>
);

const Plan = (
  <>
    <Header />
    <div className="card flex flex-col items-center gap-3 rounded-[24px] p-5">
      <Bone className="h-4 w-1/3" />
      <Bone className="h-12 w-1/2" />
      <Bone className="h-3 w-2/3" />
    </div>
    <RowCard />
    <Bone className="mx-1 h-3 w-16" />
    <RowCard />
    <RowCard />
    <RowCard />
    <RowCard />
  </>
);

const More = (
  <>
    <Header />
    <div className="card flex items-center gap-4 rounded-[24px] p-4">
      <Bone className="size-16 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Bone className="h-5 w-1/2" />
        <Bone className="h-3 w-3/4" />
        <Bone className="h-3 w-1/3" />
      </div>
    </div>
    {Array.from({ length: 4 }, (_, i) => (
      <div key={i} className="card flex flex-col gap-3 rounded-[24px] p-4">
        <Bone className="h-5 w-1/3" />
        <Bone className="h-10 w-full" />
      </div>
    ))}
  </>
);

const SKELETONS: Record<TabKey, React.ReactNode> = {
  home: Home,
  chat: Chat,
  play: (
    <>
      <Header />
      <TileGrid tiles={8} />
    </>
  ),
  memories: (
    <>
      <Header wide />
      <TileGrid tiles={8} />
    </>
  ),
  plan: Plan,
  more: More,
};

/** A sub-screen: back arrow + title, then a few rows. */
const SubScreen = () => (
  <>
    <div className="flex items-center gap-3 px-1">
      <Bone className="size-9 rounded-full" />
      <Bone className="size-9 rounded-full" />
      <Bone className="h-7 w-36" />
    </div>
    {Array.from({ length: 5 }, (_, i) => (
      <RowCard key={i} />
    ))}
  </>
);
