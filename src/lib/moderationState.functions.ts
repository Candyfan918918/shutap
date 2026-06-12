// Reads the caller's own stories with moderation state.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyModerationStory = {
  id: string;
  title: string | null;
  status: string;
  moderation_status: string;
  updated_at: string;
};

export const listMyModerationStories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ data: MyModerationStory[]; error: string | null }> => {
    const ctx = context as { supabase: any; userId: string };
    const { data, error } = await ctx.supabase
      .from("stories")
      .select("id, title, status, moderation_status, updated_at")
      .eq("author_id", ctx.userId)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as MyModerationStory[], error: null };
  });
