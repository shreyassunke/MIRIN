import type { User } from "@supabase/supabase-js";

/** Display name from auth metadata (email signup, Google, or profile edit). */
export function getDisplayName(user: User | null | undefined): string {
  if (!user) return "";
  const meta = user.user_metadata ?? {};
  const raw =
    meta.full_name ?? meta.name ?? meta.given_name ?? meta.fullName ?? "";
  return typeof raw === "string" ? raw.trim() : "";
}

/** Best available contact line for the shell. */
export function getContactLine(user: User | null | undefined): string {
  if (!user) return "";
  return (user.email ?? "").trim();
}
