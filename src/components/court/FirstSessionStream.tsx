// First-session stream — the curated 5-card sequence shown immediately after
// a user claims their alias. Renders inline at the top of the home page.
// Once the user scrolls past the closing CTA, the flag clears and the normal
// stream takes over on the next render / route visit.
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  getFirstSessionStream,
  getJustDecidedVotedCase,
  type FirstSessionPost,
  type FirstSessionFinalHour,
} from "@/lib/firstSession.functions";
import {
  readFirstSession,
  clearFirstSession,
  type FirstSessionMeta,
} from "@/lib/firstSession";
import { BenchMomentCard } from "./BenchMomentCard";

interface Props {
  meta: FirstSessionMeta;
  onDone: () => void;
}

export function FirstSessionStream({ meta, onDone }: Props) {
  const fetchStream = useServerFn(getFirstSessionStream);
  const fetchDecided = useServerFn(getJustDecidedVotedCase);

  const streamQ = useQuery({
    queryKey: ["first-session-stream", meta.entryPostId ?? "none"],
    queryFn: () => fetchStream({ data: { entryPostId: meta.entryPostId } }),
    staleTime: 5 * 60 * 1000,
  });

  const decidedQ = useQuery({
    queryKey: ["first-session", "just-decided"],
    queryFn: () => fetchDecided(),
    staleTime: 30_000,
  });

  // Clear the flag after the user has had time to look at the curated stream
  // (10 minutes max — enforced by readFirstSession's TTL anyway).
  useEffect(() => {
    const t = window.setTimeout(() => {
      clearFirstSession();
      onDone();
    }, 10 * 60 * 1000);
    return () => window.clearTimeout(t);
  }, [onDone]);

  const stream = streamQ.data;

  return (
    <div className="space-y-6">
      {/* Welcome moment — 2s after mount */}
      {meta.aliasLine && (
        <BenchMomentCard
          delayMs={2000}
          text={`You are ${meta.aliasLine}. The court is now in session.`}
          testId="bench-welcome"
        />
      )}

      {/* Notification permission moment — only if a voted-on case decided. */}
      {decidedQ.data && (
        <NotificationPermissionMoment caseTitle={decidedQ.data.title} />
      )}

      {/* 1. Entry case (their action highlighted) */}
      {stream?.entry && (
        <FirstSessionEntryCard
          post={stream.entry}
          actionLabel={describeAction(meta.entryAction)}
        />
      )}

      {/* 2. HOF dramatic today */}
      {stream?.dramatic && (
        <FirstSessionStoryCard
          post={stream.dramatic}
          eyebrow="Most dramatic today"
          accent="from-rose-500/30 to-amber-500/20"
        />
      )}

      {/* 3. HOF relatable this week */}
      {stream?.relatable && (
        <FirstSessionStoryCard
          post={stream.relatable}
          eyebrow="Most relatable this week"
          accent="from-emerald-500/25 to-sky-500/20"
          showRelate
        />
      )}

      {/* 4. Spill CTA */}
      <SpillCTACard />

      {/* 5. Live court case in final hour */}
      {stream?.finalHour && <FinalHourCard data={stream.finalHour} />}

      {/* Closing sentence — after final card */}
      <FirstSessionCloser onDismiss={() => {
        clearFirstSession();
        onDone();
      }} />
    </div>
  );
}

function describeAction(action?: string): string | null {
  switch (action) {
    case "vote":
      return "Your verdict is on the record.";
    case "relate":
      return "You marked this as relatable.";
    case "comment":
      return "Your comment is in the thread.";
    default:
      return null;
  }
}

function FirstSessionEntryCard({
  post,
  actionLabel,
}: {
  post: FirstSessionPost;
  actionLabel: string | null;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-3xl border border-primary/40 bg-card p-5 sm:p-6 relative overflow-hidden"
    >
      <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-accent" />
      <p className="text-[11px] uppercase tracking-[0.2em] text-primary/80 font-semibold">
        You just acted on this
      </p>
      <h2 className="mt-2 font-semibold text-lg sm:text-xl leading-snug">
        {post.title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground line-clamp-3 whitespace-pre-line">
        {post.storyText}
      </p>
      {actionLabel && (
        <p className="mt-3 text-xs text-primary font-medium">{actionLabel}</p>
      )}
      <Link
        to="/post/$postId"
        params={{ postId: post.id }}
        className="mt-4 inline-block text-xs text-muted-foreground hover:text-foreground"
      >
        See the full thread →
      </Link>
    </motion.article>
  );
}

function FirstSessionStoryCard({
  post,
  eyebrow,
  accent,
  showRelate,
}: {
  post: FirstSessionPost;
  eyebrow: string;
  accent: string;
  showRelate?: boolean;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-3xl border border-border bg-card p-5 sm:p-6 relative overflow-hidden"
    >
      <div
        className={`absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl bg-gradient-to-br ${accent}`}
      />
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold relative">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-semibold text-lg sm:text-xl leading-snug relative">
        {post.title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground line-clamp-4 whitespace-pre-line relative">
        {post.storyText}
      </p>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground relative">
        <span>
          {showRelate
            ? `🫂 ${post.relateCount.toLocaleString()} been there`
            : `⚖️ ${post.verdictTotal.toLocaleString()} verdicts`}
        </span>
        <Link
          to="/post/$postId"
          params={{ postId: post.id }}
          className="text-foreground/80 hover:text-foreground font-medium"
        >
          Read full case →
        </Link>
      </div>
    </motion.article>
  );
}

function SpillCTACard() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-3xl border border-dashed border-accent/60 bg-accent/5 p-6 text-center"
    >
      <p className="text-[11px] uppercase tracking-[0.3em] text-accent font-semibold">
        Your turn
      </p>
      <p className="mt-3 text-base sm:text-lg font-semibold text-balance">
        Had something similar happen to you? The court is listening.
      </p>
      <Link
        to="/court"
        className="mt-5 inline-block px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold text-sm"
      >
        Spill your story →
      </Link>
    </motion.section>
  );
}

function FinalHourCard({ data }: { data: FirstSessionFinalHour }) {
  const remaining = useCountdown(data.closesAt);
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-3xl border border-rose-500/40 bg-rose-500/5 p-5 sm:p-6 relative overflow-hidden"
    >
      <span className="absolute top-3 right-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-400">
        <span className="relative inline-block h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-75" />
          <span className="absolute inset-0 rounded-full bg-rose-500" />
        </span>
        Final hour
      </span>
      <p className="text-[11px] uppercase tracking-[0.2em] text-rose-400/90 font-semibold">
        Verdict closes in {remaining}
      </p>
      <h2 className="mt-2 font-semibold text-lg sm:text-xl leading-snug">
        {data.title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground line-clamp-4 whitespace-pre-line">
        {data.storyText}
      </p>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>⚖️ {data.verdictTotal.toLocaleString()} verdicts so far</span>
        <Link
          to="/post/$postId"
          params={{ postId: data.postId }}
          className="text-foreground/80 hover:text-foreground font-medium"
        >
          Cast yours →
        </Link>
      </div>
    </motion.article>
  );
}

function FirstSessionCloser({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="text-center pt-2 pb-4"
    >
      <p className="text-sm text-muted-foreground">
        From here on, the stream shapes itself around you.
      </p>
      <button
        onClick={onDismiss}
        className="mt-2 text-xs text-muted-foreground hover:text-foreground transition"
      >
        Enter the open court →
      </button>
    </motion.section>
  );
}

function NotificationPermissionMoment({ caseTitle }: { caseTitle: string }) {
  const [done, setDone] = useState(false);
  if (done) return null;
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  if (Notification.permission !== "default") return null;
  return (
    <BenchMomentCard
      text={`The case you voted on — "${caseTitle}" — just reached a verdict. Get notified when future cases you vote on are decided.`}
      actions={[
        {
          label: "Allow notifications",
          onClick: () => {
            void Notification.requestPermission().finally(() => setDone(true));
          },
        },
        {
          label: "Maybe later",
          variant: "ghost",
          onClick: () => setDone(true),
        },
      ]}
    />
  );
}

function useCountdown(iso: string): string {
  const target = useMemo(() => new Date(iso).getTime(), [iso]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const ms = Math.max(0, target - now);
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  const seconds = Math.floor((ms % 60000) / 1000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}
