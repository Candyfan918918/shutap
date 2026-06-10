// AliasPill — three states (full / reduced / anonymous). Tap opens the alias overlay.
// Always tappable so anonymous users can sign in.
type Props = {
  emoji?: string | null;
  nationality?: string | null;
  emotion?: string | null;
  creature?: string | null;
  fixed?: boolean; // when true, render fixed top-right
  onClick?: () => void;
};

function modeFromProfile(p: Props): "full" | "reduced" | "anonymous" {
  if (!p.emoji && !p.nationality) return "anonymous";
  if (p.nationality && p.emotion && p.creature) return "full";
  return "reduced";
}

export function AliasPill(props: Props) {
  const { emoji, nationality, emotion, creature, fixed = false, onClick } = props;
  const mode = modeFromProfile(props);
  const label =
    mode === "full"
      ? `${emoji ?? "🦉"} ${nationality} ${emotion} ${creature}`
      : mode === "reduced"
        ? `${emoji ?? "🦉"} ${nationality ?? "Anonymous"}…`
        : `${emoji ?? "🦉"} Anonymous`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 h-8 text-[12px] font-medium leading-none truncate max-w-[200px] transition active:scale-[0.97] ${
        fixed ? "fixed top-3 right-3 z-40 shadow-sm" : ""
      }`}
      style={{
        background: "var(--c-surface-3)",
        color: "var(--c-text-1)",
        borderRadius: "var(--r-pill, 9999px)",
        border: "0.5px solid var(--c-border)",
      }}
      aria-label="Open alias overlay"
    >
      <span aria-hidden className="text-[14px]">{emoji ?? "🦉"}</span>
      <span className="truncate">{label.replace(/^\S+\s/, "")}</span>
    </button>
  );
}
