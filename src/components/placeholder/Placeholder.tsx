import { Card } from "@/components/ui/Card";

interface PlaceholderProps {
  emoji: string;
  title: string;
  blurb: string;
  phase: number;
}

/** Friendly stand-in for a tab whose features arrive in a later phase. */
export function Placeholder({ emoji, title, blurb, phase }: PlaceholderProps) {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 px-1">
        <span className="text-4xl" aria-hidden>
          {emoji}
        </span>
        <h1 className="text-3xl font-semibold">{title}</h1>
      </header>
      <Card className="flex flex-col items-center gap-2 py-10 text-center">
        <div className="grid size-16 place-items-center rounded-full bg-accent-soft text-3xl" aria-hidden>
          {emoji}
        </div>
        <p className="max-w-xs text-muted">{blurb}</p>
        <p className="mt-2 rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-muted">
          Arrives in phase {phase}
        </p>
      </Card>
    </div>
  );
}
