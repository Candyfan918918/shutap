export type CourtTab = "near" | "country" | "world";

const CATEGORIES = [
  { key: "all",        label: "All" },
  { key: "romance",    label: "Romance" },
  { key: "family",     label: "Family" },
  { key: "work",       label: "Work" },
  { key: "friendship", label: "Friendship" },
  { key: "service",    label: "Service" },
  { key: "stranger",   label: "Stranger" },
  { key: "digital",    label: "Digital" },
] as const;

export type CourtCategory = (typeof CATEGORIES)[number]["key"];

export function CourtTabs({
  value,
  onChange,
  countryLabel,
  category,
  onCategoryChange,
}: {
  value: CourtTab;
  onChange: (v: CourtTab) => void;
  countryLabel: string;
  category?: CourtCategory;
  onCategoryChange?: (c: CourtCategory) => void;
}) {
  const items: Array<{ key: CourtTab; label: string }> = [
    { key: "near", label: "📍 Near you" },
    { key: "country", label: countryLabel },
    { key: "world", label: "🌎 World" },
  ];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {items.map((it) => {
          const active = value === it.key;
          return (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition border ${
                active
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "bg-surface-elevated border-border text-foreground hover:border-primary/40"
              }`}
            >
              {it.label}
            </button>
          );
        })}
      </div>
      {onCategoryChange && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {CATEGORIES.map((cat) => {
            const active = (category ?? "all") === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => onCategoryChange(cat.key)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition border ${
                  active
                    ? "bg-foreground text-background border-transparent"
                    : "bg-surface-elevated border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
