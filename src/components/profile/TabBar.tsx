// Underlined tab bar for the profile.
export function TabBar<T extends string>({ tabs, active, onChange }: {
  tabs: Array<{ id: T; label: string; emoji?: string }>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="sticky top-0 z-20 bg-background/85  border-b border-border">
      <div className="flex">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex-1 py-3 text-sm font-medium relative ${
              active === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{t.emoji ? `${t.emoji} ` : ""}{t.label}</span>
            {active === t.id && (
              <span className="absolute left-1/4 right-1/4 -bottom-px h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
