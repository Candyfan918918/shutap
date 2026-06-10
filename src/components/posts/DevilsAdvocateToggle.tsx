// DevilsAdvocateToggle — flips the user's voting POV. Default off.
interface Props {
  active: boolean;
  onToggle: (next: boolean) => void;
}

export function DevilsAdvocateToggle({ active, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!active)}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-left transition ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-surface-elevated border-border hover:border-primary/40"
      }`}
      aria-pressed={active}
    >
      <span className="text-sm font-medium">😈 Vote as the other person</span>
      <span
        className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
          active ? "bg-white/20" : "bg-muted text-muted-foreground"
        }`}
      >
        {active ? "ON" : "OFF"}
      </span>
    </button>
  );
}
