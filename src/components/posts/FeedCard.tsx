import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { FeedItem } from "@/lib/posts/feed.functions";
import { CountdownChip } from "@/components/court/CountdownChip";
import { AnonymityGuarantee } from "@/components/identity/AnonymityGuarantee";

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

function ScoreBadge({ score, small = false }: { score: number; small?: boolean }) {
  return (
    <div className={`${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"} rounded-md font-medium bg-primary text-primary-foreground`}>
      {score}
    </div>
  );
}

function FeedCardImpl({ item, index, court }: { item: FeedItem; index: number; court?: CourtRibbon }) {
  const tall = index % 3 === 1;
  const location = [item.cityLabel, item.countryCode].filter(Boolean).join(" · ");
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index * 0.03, 0.25) }}
      className="mb-3 break-inside-avoid rounded-2xl overflow-hidden border border-border bg-card hover:border-primary/40 transition group"
    >
      <Link to="/post/$postId" params={{ postId: item.id }} search={{ shared: 2 }}>
        <div className={`relative ${tall ? "aspect-[3/4]" : "aspect-[4/3]"} bg-gradient-to-br from-surface-elevated via-surface to-card flex items-center justify-center p-4 overflow-hidden`}>
          {item.mediaUrl ? (
            <img
              src={item.mediaUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <p className="relative font-display text-lg sm:text-xl leading-snug text-balance text-center line-clamp-6 text-foreground/85">
              "{item.storyText}"
            </p>
          )}
          {item.score != null && (
            <div className="absolute top-2 right-2"><ScoreBadge score={item.score} small /></div>
          )}
          {item.isSeed && (
            <div className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded-full bg-background/60 border border-border ">
              example
            </div>
          )}
          <div className="absolute bottom-2 left-2 right-2">
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-background/70  border border-border font-medium">
              {item.funnyLabel}
            </span>
          </div>
        </div>
        <div className="p-3 space-y-2">
          {court && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/15 text-primary border border-primary/40">
                {court.status === "legendary" ? "🔥 Legendary" : "⚖️ In Court"}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-elevated border border-border text-muted-foreground">
                {court.regionLabel}
              </span>
              {court.closesAt && <CountdownChip to={court.closesAt} prefix="Judgment in" />}
            </div>
          )}
          <p className="font-display text-base leading-snug line-clamp-2">{item.title}</p>
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5 min-w-0">
              <AnonymityGuarantee variant="tooltip" />
              <div className="h-5 w-5 rounded-full bg-primary shrink-0" />
              <span className="truncate">{item.author?.nickname ?? item.author?.handle ?? "anon"}</span>
            </div>
            {location && <span className="shrink-0 truncate">📍 {location}</span>}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
            <span title="views">👀 {fmt(item.viewCount)}</span>
            <span title="comments">💬 {fmt(item.commentCount)}</span>
            <span title="verdicts">⚖️ {fmt(item.verdictCount)}</span>
            <span title="shares">📤 {fmt(item.shareCount)}</span>
            <span title="saves">🔖 {fmt(item.saveCount)}</span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
