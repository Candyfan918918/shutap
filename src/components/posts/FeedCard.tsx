import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { FeedItem } from "@/lib/posts/feed.functions";
import { CountdownChip } from "@/components/court/CountdownChip";

export interface CourtRibbon {
  caseId: string;
  closesAt: string | null;
  regionLabel: string;
  status: "in_court" | "legendary" | "nominated" | "judgment_pending" | "decided";
}

function fmt(n: number) {
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/**
 * Snackable, low-density feed card.
 * Shows: status chip (optional), headline (1-2 lines), 3 reactions, location/watching.
 * Hides: long story preview, score badge, view/save/share metric strip — those live on detail.
 */
export function FeedCard({ item, court }: { item: FeedItem; index?: number; court?: CourtRibbon }) {
  const location = [item.cityLabel, item.countryCode].filter(Boolean).join(" · ");
  const watching = item.viewCount;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25 }}
      className="rounded-card bg-card border border-border/60 shadow-soft hover:shadow-lg transition overflow-hidden"
    >
      <Link to="/post/$postId" params={{ postId: item.id }} search={{ shared: 2 }} className="block p-6 sm:p-7">
        {/* Status row */}
        <div className="flex items-center gap-2 flex-wrap mb-4 min-h-[24px]">
          {court ? (
            <>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary/10 text-primary">
                {court.status === "legendary" ? "🔥 Legendary" : "⚖️ Court in session"}
              </span>
              {court.closesAt && (
                <CountdownChip to={court.closesAt} prefix="Verdict in" />
              )}
            </>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-surface text-muted-foreground">
              {item.funnyLabel ?? "🔥 Trending"}
            </span>
          )}
          {watching > 50 && (
            <span className="text-[11px] text-muted-foreground ml-auto">
              👀 {fmt(watching)} watching
            </span>
          )}
        </div>

        {/* Headline — the hero of the card */}
        <h3 className="font-display text-[22px] leading-snug font-bold text-balance line-clamp-3">
          "{item.title}"
        </h3>

        {/* Footer: location + reactions */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground truncate">
            {location ? `📍 ${location}` : item.author?.nickname ?? "anonymous"}
          </div>
          <div className="flex items-center gap-1 text-sm">
            <span className="px-2 py-1 rounded-full bg-surface" title="Support">❤️</span>
            <span className="px-2 py-1 rounded-full bg-surface" title="Need receipts">👀</span>
            <span className="px-2 py-1 rounded-full bg-surface" title="This is wild">😂</span>
            <span className="ml-1 text-[11px] text-muted-foreground tabular-nums">
              {fmt(item.commentCount)}
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
