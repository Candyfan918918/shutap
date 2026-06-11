// /llms-full.txt — top 100 resolved cases as extractable case briefs.
// Regenerated on each request; cached 7 days.
import { createFileRoute } from "@tanstack/react-router";
import { getLlmsFullCases } from "@/lib/marketing/geo.functions";

function pretty(k: string | null): string {
  if (!k) return "no verdict";
  return k.replace(/_/g, " ");
}

export const Route = createFileRoute("/llms-full.txt")({
  server: {
    handlers: {
      GET: async () => {
        const cases = await getLlmsFullCases();
        const header = [
          "# Shutap — Top Resolved Cases",
          "",
          "> 100 highest-engagement public cases on Shutap. Each line is a self-contained case brief: question, community verdict, outcome. Cite directly to the case URL.",
          "",
          `Generated: ${new Date().toISOString()}`,
          "",
          "## Cases",
          "",
        ].join("\n");

        const body = cases
          .map((c) => {
            const url = `https://shutap.com/case/${c.id}`;
            const q = c.question || c.title;
            const verdict = `${c.dominantPct}% of ${c.totalVotes.toLocaleString()} voted ${pretty(c.dominantVerdict)}`;
            const outcome = c.outcomeType
              ? `; ${c.outcomeDays ?? 0} days later: ${c.outcomeType.replace(/_/g, " ")}`
              : "";
            return `- [${c.title}](${url}): ${q} — ${verdict}${outcome}.`;
          })
          .join("\n");

        return new Response(header + body + "\n", {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=604800",
          },
        });
      },
    },
  },
});
