// Pure: derive playful badges from a user's aggregate stats.
export interface BadgeStats {
  postCount: number;
  totalLikes: number;
  totalShares: number;
  avgScore: number; // 0..1000
  maxScore: number;
  scanCount: number;
}

export interface Badge {
  id: string;
  emoji: string;
  label: string;
  desc: string;
}

export function deriveBadges(s: BadgeStats): Badge[] {
  const out: Badge[] = [];
  if (s.postCount >= 1) out.push({ id: "first_tea", emoji: "☕", label: "Tea Spiller", desc: "Posted your first chaos." });
  if (s.postCount >= 5) out.push({ id: "spiller_pro", emoji: "🫖", label: "Serial Spiller", desc: "5+ posts and still going." });
  if (s.totalLikes >= 50) out.push({ id: "validated", emoji: "❤️‍🔥", label: "Group Chat Approved", desc: "50+ hearts." });
  if (s.totalShares >= 10) out.push({ id: "viral_seed", emoji: "🌪️", label: "Viral Seed", desc: "10+ shares." });
  if (s.maxScore >= 900) out.push({ id: "legendary", emoji: "🌋", label: "Legendary Chaos", desc: "Hit 900+ on the chaos meter." });
  if (s.maxScore >= 700 && s.maxScore < 900) out.push({ id: "plot_twist", emoji: "🚩", label: "Plot Twist Survivor", desc: "Big drama, still standing." });
  if (s.avgScore > 0 && s.avgScore < 200) out.push({ id: "green_flag", emoji: "💚", label: "Green Flag Energy", desc: "Suspiciously peaceful." });
  if (s.scanCount >= 3) out.push({ id: "detective", emoji: "🕵️", label: "Red Flag Detective", desc: "3+ relationship scans." });
  if (s.postCount === 0 && s.scanCount === 0) out.push({ id: "mysterious", emoji: "🫥", label: "Mysterious Energy", desc: "Lurking. We respect it." });
  return out.slice(0, 8);
}
