import { scoreTier } from "@/lib/posts/types";

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
  const tier = scoreTier(score);
  const grad =
    tier === "legendary"
      ? "from-[oklch(0.62_0.22_25)] to-[oklch(0.45_0.2_300)]"
      : tier === "high"
      ? "from-[oklch(0.62_0.22_25)] to-[oklch(0.55_0.2_40)]"
      : tier === "mid"
      ? "from-[oklch(0.6_0.18_60)] to-[oklch(0.55_0.18_30)]"
      : tier === "low"
      ? "from-[oklch(0.55_0.16_200)] to-[oklch(0.5_0.15_280)]"
      : "from-[oklch(0.65_0.15_340)] to-[oklch(0.55_0.15_300)]";

  return (
    <div
      className={`relative aspect-[4/5] rounded-3xl overflow-hidden bg-gradient-to-br ${grad} p-6 text-white shadow-2xl`}
    >
      {mediaUrl && (
        <img
          src={mediaUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
      )}
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative h-full flex flex-col justify-between">
        <div className="text-xs uppercase tracking-widest opacity-80">Shutap Chaos Score™</div>
        <div className="text-center">
          <div className="text-7xl sm:text-8xl font-black tabular-nums drop-shadow-2xl">{score}</div>
          <div className="text-sm opacity-80 mt-1">/ 1000</div>
          <div className="mt-3 inline-block px-3 py-1 rounded-full bg-white/20 backdrop-blur text-sm font-semibold">
            {category}
          </div>
        </div>
        <div>
          <p className="text-lg sm:text-xl font-bold leading-tight text-balance">"{title}"</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <span
                key={b}
                className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 backdrop-blur border border-white/30"
              >
                {b}
              </span>
            ))}
          </div>
          <div className="mt-3 text-[10px] opacity-70">shutap.lovable.app</div>
        </div>
      </div>
    </div>
  );
}
