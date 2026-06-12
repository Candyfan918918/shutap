// /outcomes — resolved cases with their real-world outcomes. Public landing.
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const ORIGIN = "https://shutap.com";

type ResolvedCase = {
  postId: string;
  title: string;
  outcomeType: string;
  daysElapsed: number;
  outcomeDetail: string | null;
};

const getRecentOutcomes = createServerFn({ method: "GET" }).handler(
  async (): Promise<ResolvedCase[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: outcomes } = await supabaseAdmin
      .from("story_outcomes")
      .select("post_id, outcome_type, days_elapsed, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(30);

    const result: ResolvedCase[] = [];
    for (const o of (outcomes ?? []) as Array<{
      post_id: string;
      outcome_type: string;
      days_elapsed: number | null;
      detail: string | null;
    }>) {
      const { data: post } = await supabaseAdmin
        .from("posts")
        .select("id, title, case_title, status, visibility, deleted_at")
        .eq("id", o.post_id)
        .maybeSingle();
      const p = post as {
        id: string;
        title: string | null;
        case_title: string | null;
        status: string;
        visibility: string;
        deleted_at: string | null;
      } | null;
      if (!p || p.status !== "published" || p.visibility !== "public" || p.deleted_at) continue;
      result.push({
        postId: p.id,
        title: p.case_title ?? p.title ?? "Untitled case",
        outcomeType: o.outcome_type,
        daysElapsed: o.days_elapsed ?? 0,
        outcomeDetail: o.detail,
      });
      if (result.length >= 20) break;
    }
    return result;
  },
);

export const Route = createFileRoute("/outcomes")({
  loader: async () => await getRecentOutcomes(),
  component: OutcomesPage,
  head: () => headOutcomes(),
});

function OutcomesPage() {
  const outcomes = Route.useLoaderData();

  return (
    <main className="min-h-screen bg-c-surface text-c-text-1">
      <header className="border-b border-c-border">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-serif text-base tracking-tight">Shutap</Link>
          <Link to="/data" className="text-xs text-c-text-2 hover:text-c-text-1">Verdict Data</Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <h1 className="font-serif text-3xl sm:text-5xl tracking-tight">Outcomes</h1>
        <p className="mt-3 text-sm text-c-text-3">
          Cases the storyteller returned to close. What the court ruled, and what actually happened next.
        </p>

        <ul className="mt-10 divide-y divide-c-border border-y border-c-border">
          {outcomes.length === 0 && (
            <li className="py-6 text-sm text-c-text-3 italic">No outcomes reported yet.</li>
          )}
          {outcomes.map((o: ResolvedCase) => (
            <li key={o.postId} className="py-5">
              <Link
                to="/case/$caseSlug"
                params={{ caseSlug: o.postId }}
                className="block hover:bg-c-surface-2 -mx-2 px-2 py-1 transition"
              >
                <div className="font-serif text-lg text-c-text-1">{o.title}</div>
                <div className="mt-1 text-sm text-c-text-2">
                  {o.daysElapsed} days later: {o.outcomeType.replace(/_/g, " ")}.
                  {o.outcomeDetail ? ` ${o.outcomeDetail.slice(0, 160)}${o.outcomeDetail.length > 160 ? "…" : ""}` : ""}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </article>
    </main>
  );
}
