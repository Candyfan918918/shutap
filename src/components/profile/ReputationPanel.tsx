// Community reputation panel: score, helpfulness, streak, badges, funniest comments.
import { Link } from "@tanstack/react-router";
import type { Badge } from "@/lib/badges";
import type { ReputationSummary } from "@/lib/reputation.functions";

function Stat({ label, value, emoji }: { label: string; value: string | number; emoji: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-3 text-center">
      <div className="text-2xl leading-none mb-1">{emoji}</div>
      <div className="font-bold tabular-nums text-lg leading-none">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function BadgeCard({ b }: { b: Badge }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4 text-center hover:border-primary/40 transition">
      <div className="text-4xl mb-2">{b.emoji}</div>
      <div className="font-semibold text-sm">{b.label}</div>
      <div className="text-xs text-muted-foreground mt-1">{b.desc}</div>
    </div>
  );
}

export function ReputationPanel({
  rep,
  achievementBadges,
}: {
  rep: ReputationSummary | undefined;
  achievementBadges: Badge[];
}) {
  if (!rep) {
    return (
      <div className="px-8 py-16 text-center text-muted-foreground">
        <div className="text-4xl mb-2">🏆</div>
        <div>loading reputation…</div>
      </div>
    );
  }

  const { stats, score, helpfulness, badges, funniestComments } = rep;
  const allBadges = [...badges, ...achievementBadges];

  return (
    <div className="p-4 space-y-6">
      {/* Reputation card */}
      <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-card to-accent/10 border border-border p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Community reputation</div>
            <div className="font-black text-3xl tabular-nums mt-1">{score}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Helpfulness</div>
            <div className="font-bold text-lg tabular-nums">{helpfulness}<span className="text-muted-foreground text-sm">/100</span></div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-4">
          <Stat emoji="💬" label="comments" value={stats.commentCount} />
          <Stat emoji="❤️" label="hearts" value={stats.commentLikes} />
          <Stat emoji="😂" label="funny" value={stats.commentFunny} />
          <Stat emoji="⚖️" label="verdicts" value={stats.verdictsCast} />
          <Stat emoji="🚩" label="red flags" value={stats.redFlagVotesCast} />
          <Stat emoji="💚" label="hope" value={stats.hopeVotesCast} />
          <Stat emoji="👀" label="updates" value={stats.updateRequestsGiven} />
          <Stat emoji="🔥" label="streak" value={stats.currentStreak} />
        </div>
        {stats.longestStreak > stats.currentStreak && (
          <div className="text-[11px] text-muted-foreground mt-3 text-center">
            longest streak: <span className="font-semibold">{stats.longestStreak}</span> days
          </div>
        )}
      </div>

      {/* Badges */}
      {allBadges.length > 0 ? (
        <div>
          <div className="text-sm font-semibold text-muted-foreground px-1 mb-2">Badges</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {allBadges.map((b) => <BadgeCard key={b.id} b={b} />)}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <div className="text-3xl mb-1">🏆</div>
          no badges yet — comment, vote, support people, build your rep.
        </div>
      )}

      {/* Funniest comments */}
      {funniestComments.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-muted-foreground px-1 mb-2">Funniest comments</div>
          <div className="space-y-2">
            {funniestComments.map((c) => (
              <Link
                key={c.id}
                to="/post/$postId"
                params={{ postId: c.postId }}
                className="block rounded-2xl bg-card border border-border p-3 hover:border-primary/40 transition"
              >
                <div className="text-sm text-foreground/90 line-clamp-3 whitespace-pre-wrap">{c.body}</div>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  {c.funnyCount > 0 && <span>😂 {c.funnyCount}</span>}
                  {c.likeCount > 0 && <span>❤️ {c.likeCount}</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
