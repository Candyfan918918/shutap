// StoryCard — Xiaohongshu-style card driven by shared design tokens
// (--card-*, --stream-*). Auto-generates a procedural cover when no media.
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import type { StoryPayload } from "@/lib/stream.functions";
import { generateScoreCardCoverSVG } from "@/lib/stream/generate-cover";
import { AliasPill } from "./AliasPill";
import { CompactVerdictBar } from "./CompactVerdictBar";
import { CourtRibbon } from "./CourtRibbon";
import { RelateButton } from "./RelateButton";
import { ActionSheet } from "./ActionSheet";
import { useLongPress } from "./useLongPress";
import { useSoftGate } from "./useSoftGate";
import { NominateActionSheet } from "@/components/hof/NominateActionSheet";

type PayloadWithMedia = StoryPayload & { media_url?: string | null };

function scoreTone(score: number): { bg: string; fg: string; label: string } {
  if (score >= 800) return { bg: "var(--c-amber)", fg: "#fff", label: "On fire" };
  if (score >= 500) return { bg: "var(--c-coral)", fg: "#fff", label: "Hot" };
  if (score >= 200) return { bg: "var(--c-purple)", fg: "#fff", label: "Warm" };
  return { bg: "var(--c-surface-3)", fg: "var(--c-text-2)", label: "Quiet" };
}

interface Props {
  payload: PayloadWithMedia;
  index: number;
  anonymous: boolean;
}

export function StoryCard({ payload, index, anonymous }: Props) {
  const navigate = useNavigate();
  const softGate = useSoftGate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [nomOpen, setNomOpen] = useState(false);

  const tone = scoreTone(payload.score);
  const ratios = ["3/4", "4/5", "1/1", "3/4", "4/5", "4/3"];
  const coverAspect = ratios[index % ratios.length];
  const emoji = payload.author_emoji ?? "🌊";

  const coverUrl = useMemo(() => {
    if (payload.media_url) return payload.media_url;
    return generateScoreCardCoverSVG({
      seed: payload.id,
      category: payload.score_category,
      emoji,
      score: payload.score,
      title: payload.title,
      snippet: payload.snippet,
      badges: payload.score_category ? [payload.score_category, tone.label] : [tone.label],
    });
  }, [payload.id, payload.media_url, payload.score_category, payload.score, payload.title, payload.snippet, emoji, tone.label]);

  const longPress = useLongPress(() => setSheetOpen(true), 450);
  const goDetail = () => { void navigate({ to: "/post/$postId", params: { postId: payload.id } }); };

  const oneSided = !payload.both_sides_heard && payload.is_seed;

  return (
    <article
      className={`stream-card ${payload.both_sides_heard ? "stream-card--teal" : ""}`}
      {...longPress.handlers}
      onClick={(e) => { if (longPress.didTrigger()) { e.preventDefault(); return; } goDetail(); }}
      onContextMenu={(e) => { e.preventDefault(); setSheetOpen(true); }}
    >
      <div
        className="stream-card__cover"
        style={{ aspectRatio: coverAspect, backgroundImage: `url("${coverUrl}")` }}
      >
        <span
          className="stream-card__chip"
          style={{ top: 6, left: 6, background: tone.bg, color: tone.fg }}
        >
          <span className="tabular-nums">{payload.score}</span>
          <span className="opacity-80">· {tone.label}</span>
        </span>
        {payload.score_category && (
          <span className="stream-card__chip stream-card__chip--ghost" style={{ top: 6, right: 6 }}>
            {payload.score_category}
          </span>
        )}
        {payload.is_nominated && payload.case?.lock_at && (
          <div className="absolute" style={{ bottom: 6, left: 6, right: 6 }}>
            <CourtRibbon
              category={payload.case.category}
              tier={payload.case.tier}
              lockAt={payload.case.lock_at}
            />
          </div>
        )}
      </div>

      <div className="stream-card__body">
        {payload.title && <h3 className="stream-card__title">{payload.title}</h3>}
        <p className="stream-card__snippet">{payload.snippet}</p>

        {oneSided && (
          <p className="stream-card__meta italic">one side · the other hasn't spoken</p>
        )}

        <div className="pt-0.5">
          <CompactVerdictBar
            postId={payload.id}
            initialCounts={payload.verdicts as any}
            height={4}
            live
          />
        </div>

        <div className="stream-card__footer">
          <div className="min-w-0 flex-1 mr-1.5">
            <AliasPill
              emoji={payload.author_emoji}
              nationality={payload.author_nationality}
              emotion={payload.author_emotion}
              creature={payload.author_creature}
            />
          </div>
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
                toast("Felt this. The Bench took note.");
              } catch {
                toast("The court did not record that. Try again.");
              }
            }}
          />
        </div>
      </div>

      <ActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        actions={[
          { key: "bookmark", icon: "🔖", label: "Bookmark", onSelect: () => {
              if (anonymous) softGate("bookmark", { entityId: payload.id });
              else toast("Saved for later judgment.");
            } },
          { key: "share", icon: "📤", label: "Share", onSelect: () => navigator.share?.({ url: `/post/${payload.id}` }) ?? toast("Link copied. Carry it as you will.") },
          { key: "debate", icon: "🗣️", label: "Debate with a friend", onSelect: () => {
              void navigate({ to: "/post/$postId", params: { postId: payload.id } });
            } },
          { key: "hof", icon: "🏛️", label: "Nominate for Hall of Fame", onSelect: () => {
              if (anonymous) softGate("hof_dramatic", { entityId: payload.id });
              else setNomOpen(true);
            } },
        ]}
      />
      <NominateActionSheet
        open={nomOpen}
        onClose={() => setNomOpen(false)}
        entityType="story"
        entityId={payload.id}
      />
    </article>
  );
}
