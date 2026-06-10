// StoryAliasBlock — full-size AliasPill + "one-sided / both sides heard" tag.
import { AliasPill } from "@/components/stream/AliasPill";

interface Props {
  emoji?: string | null;
  nationality?: string | null;
  emotion?: string | null;
  creature?: string | null;
  bothSidesHeard?: boolean | null;
  onAliasClick?: () => void;
}

export function StoryAliasBlock({
  emoji, nationality, emotion, creature, bothSidesHeard, onAliasClick,
}: Props) {
  const sideLabel = bothSidesHeard ? "Both sides heard" : "One-sided account";
  const sideColor = bothSidesHeard ? "var(--c-teal, #3aa48f)" : "var(--c-text-3)";
  return (
    <div className="flex items-center gap-2">
      <AliasPill
        emoji={emoji}
        nationality={nationality}
        emotion={emotion}
        creature={creature}
        onClick={onAliasClick}
      />
      <span className="text-[11px]" style={{ color: sideColor }}>{sideLabel}</span>
    </div>
  );
}
