// Single profile bootstrap — used by finalizeIdentity and verifyAge so they
// don't race each other on first-time profile insertion. The DB trigger
// handle_new_user is still wired in as defense-in-depth.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface BootstrappedProfile {
  id: string;
  email: string | null;
  age_verified: boolean | null;
  nationality: string | null;
  emotion: string | null;
  creature: string | null;
  blocked_reason: string | null;
}

export async function ensureProfile(userId: string): Promise<BootstrappedProfile> {
  const existing = await supabaseAdmin
    .from("profiles")
    .select("id, email, age_verified, nationality, emotion, creature, blocked_reason")
    .eq("id", userId)
    .maybeSingle();

  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data as BootstrappedProfile;

  const { data: authUser, error: authUserError } =
    await supabaseAdmin.auth.admin.getUserById(userId);
  if (authUserError) throw new Error(authUserError.message);

  const meta = (authUser.user.user_metadata ?? {}) as Record<string, unknown>;
  const fallbackNickname =
    (meta.full_name as string | undefined) ||
    (meta.name as string | undefined) ||
    authUser.user.email ||
    `user_${userId.slice(0, 8)}`;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: authUser.user.email,
        handle: `user_${userId.replace(/-/g, "").slice(0, 12)}`,
        nickname: fallbackNickname,
        display_name: fallbackNickname,
        locale: "en",
      } as never,
      { onConflict: "id", ignoreDuplicates: false },
    )
    .select("id, email, age_verified, nationality, emotion, creature, blocked_reason")
    .single();

  if (error) throw new Error(error.message);
  return data as BootstrappedProfile;
}
