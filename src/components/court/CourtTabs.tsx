export type CourtTab = "near" | "country" | "world";

export function CourtTabs({
  value,
  onChange,
  countryLabel,
}: {
  value: CourtTab;
  onChange: (v: CourtTab) => void;
  countryLabel: string;
}) {
  const items: Array<{ key: CourtTab; label: string }> = [
    { key: "near", label: "📍 Near You" },
    { key: "country", label: countryLabel },
    { key: "world", label: "🌎 World" },
  ];
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
              active
                ? "bg-gradient-to-r from-primary to-accent text-primary-foreground border-transparent"
                : "bg-surface-elevated border-border text-foreground hover:border-primary/40"
            }`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
