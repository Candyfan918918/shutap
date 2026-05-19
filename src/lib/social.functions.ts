// Social graph: follow/unfollow, friend requests, block.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const UserIdSchema = z.object({ userId: z.string().uuid() });

// ---------- follow ----------
export const followUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UserIdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) throw new Error("you can't follow yourself bestie");
    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: userId, followee_id: data.userId } as never);
    if (error && error.code !== "23505") throw new Error(error.message);
    return { ok: true };
  });

export const unfollowUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UserIdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", userId)
      .eq("followee_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- friendship ----------
export const sendFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UserIdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) throw new Error("can't friend yourself");
    // If they already sent you one, auto-accept
    const { data: incoming } = await supabaseAdmin
      .from("friendships")
      .select("status")
      .eq("requester_id", data.userId)
      .eq("addressee_id", userId)
      .maybeSingle();
    if (incoming?.status === "pending") {
      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted", responded_at: new Date().toISOString() } as never)
        .eq("requester_id", data.userId)
        .eq("addressee_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true, state: "accepted" as const };
    }
    const { error } = await supabase
      .from("friendships")
      .upsert(
        { requester_id: userId, addressee_id: data.userId, status: "pending" } as never,
        { onConflict: "requester_id,addressee_id", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    return { ok: true, state: "pending_out" as const };
  });

export const respondFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ requesterId: z.string().uuid(), accept: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("friendships")
      .update({
        status: data.accept ? "accepted" : "declined",
        responded_at: new Date().toISOString(),
      } as never)
      .eq("requester_id", data.requesterId)
      .eq("addressee_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeFriend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UserIdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("friendships")
      .delete()
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${data.userId}),and(requester_id.eq.${data.userId},addressee_id.eq.${userId})`,
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- friend inbox ----------
export interface FriendRow {
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  state: "pending_in" | "pending_out" | "accepted";
  since: string;
}

export const listFriendInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FriendRow[]> => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin
      .from("friendships")
      .select("requester_id, addressee_id, status, created_at, responded_at")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{
      requester_id: string;
      addressee_id: string;
      status: string;
      created_at: string;
    }>;
    const otherIds = Array.from(new Set(rows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id))));
    if (!otherIds.length) return [];
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, handle, display_name, nickname, avatar_url")
      .in("id", otherIds);
    const byId = new Map((profs ?? []).map((p) => [p.id as string, p as Record<string, unknown>]));
    return rows
      .filter((r) => r.status !== "declined")
      .map((r) => {
        const otherId = r.requester_id === userId ? r.addressee_id : r.requester_id;
        const p = byId.get(otherId);
        const state: FriendRow["state"] =
          r.status === "accepted"
            ? "accepted"
            : r.requester_id === userId
              ? "pending_out"
              : "pending_in";
        return {
          userId: otherId,
          handle: ((p?.handle as string | undefined) ?? "user"),
          displayName: ((p?.display_name as string | undefined) ?? (p?.nickname as string | undefined) ?? "user"),
          avatarUrl: ((p?.avatar_url as string | null | undefined) ?? null),
          state,
          since: r.created_at,
        };
      });
  });

// ---------- block ----------
export const blockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UserIdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) throw new Error("can't block yourself");
    const { error } = await supabase
      .from("blocks")
      .upsert({ blocker_id: userId, blocked_id: data.userId } as never, { onConflict: "blocker_id,blocked_id" });
    if (error) throw new Error(error.message);
    // Also remove follow + friendship
    await supabase.from("follows").delete().eq("follower_id", userId).eq("followee_id", data.userId);
    await supabase
      .from("friendships")
      .delete()
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${data.userId}),and(requester_id.eq.${data.userId},addressee_id.eq.${userId})`,
      );
    return { ok: true };
  });

export const unblockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UserIdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("blocks").delete().eq("blocker_id", userId).eq("blocked_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listBlocked = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: blocks, error } = await supabase
      .from("blocks")
      .select("blocked_id, created_at")
      .eq("blocker_id", userId);
    if (error) throw new Error(error.message);
    const ids = (blocks ?? []).map((b) => b.blocked_id as string);
    if (!ids.length) return [] as Array<{ userId: string; handle: string; displayName: string; avatarUrl: string | null }>;
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, handle, display_name, nickname, avatar_url")
      .in("id", ids);
    return (profs ?? []).map((p) => ({
      userId: p.id as string,
      handle: (p.handle as string) ?? "user",
      displayName: ((p.display_name as string | null) ?? (p.nickname as string | null) ?? "user"),
      avatarUrl: (p.avatar_url as string | null) ?? null,
    }));
  });
