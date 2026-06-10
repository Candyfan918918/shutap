// StoryCard — stream variant. Surface-2 / 0.5px border / --r-md.
// Aspect 4:3 vs 3:4 by index parity. Teal left border when both_sides_heard.
// Long-press / right-click opens action sheet; tap opens detail.
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import type { StoryPayload } from "@/lib/stream.functions";
import { AliasPill } from "./AliasPill";
import { CompactVerdictBar } from "./CompactVerdictBar";
import { CourtRibbon } from "./CourtRibbon";
import { RelateButton } from "./RelateButton";
import { ActionSheet } from "./ActionSheet";
import { useLongPress } from "./useLongPress";
import { useSoftGate } from "./useSoftGate";

function scoreTone(score: number): { bg: string; fg: string } {
  if (score >= 800) return { bg: "var(--c-amber-soft, #fef0d0)", fg: "var(--c-amber, #b07a18)" };
  if (score >= 500) return { bg: "var(--c-coral-soft, #ffe2dc)", fg: "var(--c-coral, #c0392b)" };
  if (score >= 200) return { bg: "var(--c-purple-soft, #ece5fa)", fg: "var(--c-purple, #6e54b3)" };
  return { bg: "var(--c-surface-3, #eee)", fg: "var(--c-text-2, #555)" };
}

interface Props {
  payload: StoryPayload;
  index: number;
  anonymous: boolean;
}

export function StoryCard({ payload, index, anonymous }: Props) {
  const navigate = useNavigate();
  const softGate = useSoftGate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const tone = scoreTone(payload.score);
  const isPortrait = index % 2 === 0; // alternate 3:4 / 4:3
  const aspect = isPortrait ? "3/4" : "4/3";
  const teal = payload.both_sides_heard ? "2px solid var(--c-teal, #3aa48f)" : undefined;

  const longPress = useLongPress(() => setSheetOpen(true), 450);

  const goDetail = () => { void navigate({ to: "/post/$postId", params: { postId: payload.id } }); };

  const oneSided = !payload.both_sides_heard && payload.is_seed;

  return (
    <article
      className="relative flex flex-col overflow-hidden cursor-pointer transition active:scale-[0.995]"
      style={{
        background: "var(--c-surface-2, #faf6f1)",
        borderRadius: "var(--r-md, 14px)",
        border: "0.5px solid var(--c-border, #e3ddd2)",
        borderLeft: teal,
        aspectRatio: aspect,
      }}
      {...longPress.handlers}
      onClick={(e) => { if (longPress.didTrigger()) { e.preventDefault(); return; } goDetail(); }}
      onContextMenu={(e) => { e.preventDefault(); setSheetOpen(true); }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-3 pt-2.5">
        <AliasPill
          emoji={payload.author_emoji}
          nationality={payload.author_nationality}
          emotion={payload.author_emotion}
          creature={payload.author_creature}
        />
        <span
          className="px-2 h-5 inline-flex items-center text-[9.5px] font-semibold uppercase tracking-[0.05em] rounded-full"
          style={{ background: tone.bg, color: tone.fg }}
        >
          {payload.score}
        </span>
      </div>

      {oneSided && (
        <p className="px-3 mt-1 text-[10px] italic" style={{ color: "var(--c-text-3, #888)" }}>
          one side · the other hasn't spoken
        </p>
      )}

      {/* Body */}
      <div className="px-3 pt-2 flex-1 min-h-0">
        {payload.title && (
          <h3 className="text-[13px] font-medium leading-snug line-clamp-2" style={{ color: "var(--c-text-1)" }}>
            {payload.title}
          </h3>
        )}
        <p
          className="text-[12px] leading-snug mt-1 line-clamp-3"
          style={{ color: "var(--c-text-2, #555)" }}
        >
          {payload.snippet}
        </p>
      </div>

      {/* Footer */}
      <div className="px-3 pb-2.5 pt-2 space-y-1.5">
        <CompactVerdictBar
          postId={payload.id}
          initialCounts={payload.verdicts as any}
          height={6}
          live
        />
        <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--c-text-3)" }}>
          <RelateButton
            count={payload.relate_count}
            compact
            onActivate={async () => {
              if (anonymous) {
                softGate("relate", { entityId: payload.id });
                return;
              }
              try {
                const { reactToPost } = await import("@/lib/posts/engagement.functions");
                await reactToPost({ data: { postId: payload.id, kind: "been_there" } } as any);
                toast("Felt this.");
              } catch {
                toast("Couldn't record that.");
              }
            }}
          />
          <span className="tabular-nums">💬 {payload.comment_count}</span>
        </div>
      </div>

      {/* Court ribbon overlay */}
      {payload.is_nominated && payload.case?.lock_at && (
        <div className="absolute bottom-2 right-2">
          <CourtRibbon
            category={payload.case.category}
            tier={payload.case.tier}
            lockAt={payload.case.lock_at}
          />
        </div>
      )}

      <ActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        actions={[
          { key: "bookmark", icon: "🔖", label: "Bookmark", onSelect: () => {
              if (anonymous) softGate("bookmark", { entityId: payload.id });
              else toast("Saved to your bench.");
            } },
          { key: "share", icon: "📤", label: "Share", onSelect: () => navigator.share?.({ url: `/post/${payload.id}` }) ?? toast("Link copied.") },
          { key: "debate", icon: "🗣️", label: "Debate with a friend", onSelect: () => {
              void navigate({ to: "/post/$postId", params: { postId: payload.id } });
            } },
          { key: "hof", icon: "🏛️", label: "Nominate to HOF", onSelect: () => {
              if (anonymous) softGate("hof_dramatic", { entityId: payload.id });
              else toast("Nomination noted.");
            } },
        ]}
      />
    </article>
  );
}
