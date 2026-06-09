// Daily cron: finds decided court cases at 30/90/180/365-day marks and pings authors.
// Called by pg_cron via pg_net. Auth: apikey header == SUPABASE_PUBLISHABLE_KEY.
import { createFileRoute } from "@tanstack/react-router";

const MILESTONES = [30, 90, 180, 365] as const;

export const Route = createFileRoute("/api/public/hooks/outcome-tracker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const sent: { story_id: string; milestone: number }[] = [];

        for (const milestone of MILESTONES) {
          const cutoff = new Date(Date.now() - milestone * 86400000).toISOString();
          const window = new Date(Date.now() - (milestone + 1) * 86400000).toISOString();

          // Decided cases whose post entered "decided" within today's milestone window.
          const { data: cases } = await supabaseAdmin
            .from("court_cases")
            .select("id, post_id, decided_at")
            .eq("status", "decided")
            .gte("decided_at", window)
            .lte("decided_at", cutoff);

          for (const c of cases ?? []) {
            // Skip if already sent for this milestone.
            const { count } = await supabaseAdmin
              .from("outcome_reminders")
              .select("id", { count: "exact", head: true })
              .eq("story_id", c.post_id)
              .eq("milestone_day", milestone);
            if (count && count > 0) continue;

            const { data: post } = await supabaseAdmin
              .from("posts")
              .select("author_id, title")
              .eq("id", c.post_id)
              .maybeSingle();
            if (!post?.author_id) continue;

            await supabaseAdmin.from("outcome_reminders").insert({
              story_id: c.post_id,
              milestone_day: milestone,
            });

            const recipients = new Set<string>([post.author_id]);

            // Notify every verified named-party responder too.
            const { data: parties } = await supabaseAdmin
              .from("post_perspectives")
              .select("responder_id")
              .eq("post_id", c.post_id)
              .eq("standing_status", "verified")
              .eq("role", "named_party");
            for (const p of parties ?? []) {
              const rid = (p as any).responder_id as string | null;
              if (rid) recipients.add(rid);
            }

            for (const user_id of recipients) {
              await supabaseAdmin.from("notifications").insert({
                user_id,
                kind: "outcome_reminder",
                payload: {
                  story_id: c.post_id,
                  milestone_day: milestone,
                  title: post.title,
                  message: `${milestone} days since the verdict. Any update?`,
                },
              });
            }

            sent.push({ story_id: c.post_id, milestone });
          }
        }

        return Response.json({ data: { sent }, error: null });
      },
    },
  },
});
