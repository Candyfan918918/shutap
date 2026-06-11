// Dashboard metrics. Reads via service role; gated by admin session.
import { createServerFn } from "@tanstack/react-start";

export interface AdminMetric {
  key: string;
  label: string;
  value: number;
  deltaPct: number | null; // vs yesterday same window; null if no baseline
}

export const getDashboardMetrics = createServerFn({ method: "GET" })
  .handler(async () => {
    const { requireAdminSession } = await import("./session.server");
    const s = await requireAdminSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z").toISOString();
    const yesterdayStart = new Date(new Date(todayStart).getTime() - 24 * 60 * 60 * 1000).toISOString();

    async function countWhere(table: string, build: (q: any) => any): Promise<number> {
      const q = supabaseAdmin.from(table).select("*", { count: "exact", head: true });
      const { count } = await build(q);
      return count ?? 0;
    }
    const pct = (cur: number, prev: number): number | null => {
      if (prev === 0) return cur === 0 ? 0 : null;
      return Math.round(((cur - prev) / prev) * 100);
    };

    const [
      votesHour, votesPrevHour,
      courtOpen,
      spillOpen,
      storiesToday, storiesYesterday,
      queueOpen,
      activeUsers24, activeUsersPrev,
    ] = await Promise.all([
      countWhere("post_verdict_votes", (q) => q.gte("created_at", hourAgo)),
      countWhere("post_verdict_votes", (q) =>
        q.gte("created_at", new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()).lt("created_at", hourAgo)),
      countWhere("court_cases", (q) => q.eq("status", "in_court")),
      countWhere("post_drafts", (q) => q.in("status", ["open", "draft", "active"])),
      countWhere("posts", (q) => q.gte("published_at", todayStart)),
      countWhere("posts", (q) => q.gte("published_at", yesterdayStart).lt("published_at", todayStart)),
      countWhere("mod_queue", (q) => q.eq("status", "pending")),
      countWhere("post_views", (q) => q.gte("viewed_at", dayAgo)),
      countWhere("post_views", (q) => q.gte("viewed_at", twoDaysAgo).lt("viewed_at", dayAgo)),
    ]);

    // Role-filtered card list. Mods don't see lead/partner data; partner_managers see lead-flavored cards instead.
    const role = s.role;
    const cards: AdminMetric[] = [];
    if (role !== "partner_manager") {
      cards.push({ key: "active_24h", label: "Active sessions (24h)", value: activeUsers24, deltaPct: pct(activeUsers24, activeUsersPrev) });
      cards.push({ key: "votes_hour", label: "Verdicts cast (1h)", value: votesHour, deltaPct: pct(votesHour, votesPrevHour) });
      cards.push({ key: "court_open", label: "Active Court cases", value: courtOpen, deltaPct: null });
      cards.push({ key: "spill_open", label: "Spill sessions open", value: spillOpen, deltaPct: null });
      cards.push({ key: "stories_today", label: "Stories today", value: storiesToday, deltaPct: pct(storiesToday, storiesYesterday) });
    }
    if (role === "super_admin" || role === "moderator") {
      cards.push({ key: "queue_open", label: "Queue items open", value: queueOpen, deltaPct: null });
    }
    if (role === "partner_manager" || role === "super_admin") {
      const [leadsOpen, leadsContactedDay] = await Promise.all([
        countWhere("leads", (q) => q.eq("status", "open")),
        countWhere("lead_contacts", (q) => q.gte("created_at", dayAgo)),
      ]);
      cards.push({ key: "leads_open", label: "Open leads", value: leadsOpen, deltaPct: null });
      cards.push({ key: "lead_contacts_24h", label: "Lead contacts (24h)", value: leadsContactedDay, deltaPct: null });
    }
    return { cards, role, queueOpen };
  });
