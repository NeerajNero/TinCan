import { Spinner } from "@/components/ui/Spinner";

/** Shown by Next while a tab's code and data are on their way. */
export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-20 text-[var(--accent)]">
      <Spinner size={28} />
    </div>
  );
}
