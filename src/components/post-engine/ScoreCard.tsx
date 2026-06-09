export function ScoreCard({
  score,
  category,
  title,
  badges,
  mediaUrl,
}: {
  score: number;
  category: string;
  title: string;
  badges: string[];
  mediaUrl?: string | null;
}) {
  return (
    <div className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-surface border border-border p-6 text-foreground ">
      {mediaUrl && (
        <>
          <img
            src={mediaUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-background/60" />
        </>
      )}
      <div className="relative h-full flex flex-col justify-between">
        <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          Shutap Chaos Score™
        </div>
        <div className="text-center">
          <div className="text-7xl sm:text-8xl font-medium tabular-nums text-primary">
            {score}
          </div>
          <div className="text-sm text-muted-foreground mt-1">/ 1000</div>
          <div className="mt-3 inline-block px-3 py-1 rounded-full bg-tag-peach text-tag-peach-foreground text-sm font-medium">
            {category}
          </div>
        </div>
        <div>
          <p className="font-display text-2xl sm:text-3xl leading-tight text-balance text-foreground">
            "{title}"
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <span
                key={b}
                className="text-[10px] px-2 py-0.5 rounded-full bg-tag-sand text-tag-sand-foreground"
              >
                {b}
              </span>
            ))}
          </div>
          <div className="mt-3 text-[10px] text-muted-foreground">shutap.lovable.app</div>
        </div>
      </div>
    </div>
  );
}
