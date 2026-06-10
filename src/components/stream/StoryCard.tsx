// StoryCard — Xiaohongshu-style: cover-led, full-width within its column.
// Cover uses a category gradient + score + author emoji as visual anchor
// (we don't have real images yet). Content flows below: title, snippet, meta.
// Teal left border when both_sides_heard. Long-press / right-click → action sheet.
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import type { StoryPayload } from "@/lib/stream.functions";
import { AliasPill } from "./AliasPill";
import { CompactVerdictBar } from "./CompactVerdictBar";
import { CourtRibbon } from "./CourtRibbon";
import { RelateButton } from "./RelateButton";
import { ActionSheet } from "./ActionSheet";
import { useLongPress } from "./useLongPress";
import { useSoftGate } from "./useSoftGate";

function scoreTone(score: number): { bg: string; fg: string; label: string } {
  if (score >= 800) return { bg: "var(--c-amber, #b07a18)", fg: "#fff", label: "On fire" };
  if (score >= 500) return { bg: "var(--c-coral, #c0392b)", fg: "#fff", label: "Hot" };
  if (score >= 200) return { bg: "var(--c-purple, #6e54b3)", fg: "#fff", label: "Warm" };
  return { bg: "var(--c-surface-3, #eee)", fg: "var(--c-text-2, #555)", label: "Quiet" };
}

function categoryGradient(cat: string | null): string {
  const c = (cat ?? "").toLowerCase();
  if (c.includes("famil") || c.includes("mother") || c.includes("mil"))
    return "linear-gradient(155deg, #fde7f0 0%, #f6c1d3 55%, #e89bb6 100%)";
  if (c.includes("work") || c.includes("money"))
    return "linear-gradient(155deg, #fff4d1 0%, #fbe08a 55%, #e9bd4f 100%)";
  if (c.includes("stranger") || c.includes("neigh"))
    return "linear-gradient(155deg, #ffe6df 0%, #ffb7a6 55%, #e8826b 100%)";
  if (c.includes("digital") || c.includes("online"))
    return "linear-gradient(155deg, #ece5fa 0%, #c8b8f1 55%, #9c83df 100%)";
  if (c.includes("friend"))
    return "linear-gradient(155deg, #defaf0 0%, #aae6cf 55%, #5fbf9d 100%)";
  // romance / default
  return "linear-gradient(155deg, #ffe1ec 0%, #ffb3cd 55%, #ec7aa6 100%)";
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
  // XHS-style alternating cover ratios — portraits dominate, with occasional square/4:3 to break rhythm.
  const ratios = ["3/4", "4/5", "1/1", "3/4", "4/5", "4/3"];
  const coverAspect = ratios[index % ratios.length];
  const teal = payload.both_sides_heard ? "2px solid var(--c-teal, #3aa48f)" : undefined;

  const longPress = useLongPress(() => setSheetOpen(true), 450);
  const goDetail = () => { void navigate({ to: "/post/$postId", params: { postId: payload.id } }); };

  const oneSided = !payload.both_sides_heard && payload.is_seed;
  const cover = categoryGradient(payload.score_category);
  const emoji = payload.author_emoji ?? "🌊";

  return (
    <article
      className="relative flex flex-col overflow-hidden cursor-pointer transition active:scale-[0.99] hover:shadow-md"
      style={{
        background: "var(--c-surface, #fff)",
        borderRadius: "var(--r-md, 14px)",
        border: "0.5px solid var(--c-border, #e3ddd2)",
        borderLeft: teal,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
      {...longPress.handlers}
      onClick={(e) => { if (longPress.didTrigger()) { e.preventDefault(); return; } goDetail(); }}
      onContextMenu={(e) => { e.preventDefault(); setSheetOpen(true); }}
    >
      {/* Cover — XHS-style image stand-in */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: coverAspect, background: cover }}
      >
        {/* Decorative paper texture */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.45) 0%, transparent 45%), radial-gradient(circle at 80% 80%, rgba(0,0,0,0.18) 0%, transparent 50%)",
          }}
        />
        {/* Score chip */}
        <span
          className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 font-semibold rounded-full backdrop-blur-sm"
          style={{
            background: tone.bg,
            color: tone.fg,
            fontSize: "clamp(9px, 1.6vw, 11px)",
            padding: "2px 7px",
            lineHeight: 1.4,
          }}
        >
          <span className="tabular-nums">{payload.score}</span>
          <span className="opacity-80">· {tone.label}</span>
        </span>
        {/* Category bubble */}
        {payload.score_category && (
          <span
            className="absolute top-1.5 right-1.5 inline-flex items-center font-medium rounded-full"
            style={{
              background: "rgba(255,255,255,0.78)",
              color: "var(--c-text-1)",
              backdropFilter: "blur(4px)",
              fontSize: "clamp(9px, 1.5vw, 11px)",
              padding: "2px 7px",
              lineHeight: 1.4,
            }}
          >
            {payload.score_category}
          </span>
        )}
        {/* Emoji anchor */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="drop-shadow-sm select-none"
            style={{ fontSize: "clamp(40px, 11vw, 76px)" }}
            aria-hidden
          >
            {emoji}
          </span>
        </div>
        {/* Court ribbon (when nominated) */}
        {payload.is_nominated && payload.case?.lock_at && (
          <div className="absolute bottom-1.5 left-1.5 right-1.5">
            <CourtRibbon
              category={payload.case.category}
              tier={payload.case.tier}
              lockAt={payload.case.lock_at}
            />
          </div>
        )}
      </div>

      {/* Content — XHS tight padding */}
      <div className="flex flex-col" style={{ padding: "8px 10px", gap: "4px" }}>
        {payload.title && (
          <h3
            className="font-semibold line-clamp-2"
            style={{
              color: "var(--c-text-1)",
              fontSize: "clamp(12.5px, 1.9vw, 14.5px)",
              lineHeight: 1.3,
            }}
          >
            {payload.title}
          </h3>
        )}
        <p
          className="line-clamp-2"
          style={{
            color: "var(--c-text-2, #555)",
            fontSize: "clamp(11px, 1.7vw, 12.5px)",
            lineHeight: 1.35,
          }}
        >
          {payload.snippet}
        </p>

        {oneSided && (
          <p
            className="italic"
            style={{ color: "var(--c-text-3, #888)", fontSize: "clamp(9px, 1.4vw, 10.5px)" }}
          >
            one side · the other hasn't spoken
          </p>
        )}

        {/* Verdict pulse */}
        <div className="pt-0.5">
          <CompactVerdictBar
            postId={payload.id}
            initialCounts={payload.verdicts as any}
            height={4}
            live
          />
        </div>

        {/* Footer meta — XHS style: author left, relate right */}
        <div
          className="flex items-center justify-between pt-1 mt-0.5 border-t"
          style={{ borderColor: "var(--c-border, #efe9dd)" }}
        >
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
                toast("Felt this.");
              } catch {
                toast("Couldn't record that.");
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
