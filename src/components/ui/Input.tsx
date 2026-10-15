import { cn } from "@/lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/** Rounded text input matching the card look. */
export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "tap w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-base text-text",
        "placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft",
        "disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("text-xs font-bold uppercase tracking-wide text-muted", className)} {...props} />
  );
}
