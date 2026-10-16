import "server-only";

/** The two emails allowed to use this tin can. Read server-side only. */
function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowedEmails().includes(email.trim().toLowerCase());
}

/** The owner is the first email in ALLOWED_EMAILS (same rule as scripts/reset-data.mjs). */
export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowedEmails()[0] === email.trim().toLowerCase();
}
