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

// ---------- Reputation: community-side signals (not influencer) ----------
export interface ReputationStats {
  commentCount: number;
  commentLikes: number;
  commentFunny: number;
  verdictsCast: number;
  redFlagVotesCast: number;
  hopeVotesCast: number;
  updateRequestsGiven: number;
  arcsFollowed: number;
  sharesGiven: number;
  savesGiven: number;
  currentStreak: number;
  longestStreak: number;
}

export function reputationScore(s: ReputationStats): number {
  const raw =
    s.commentCount * 2 +
    s.commentLikes * 3 +
    s.commentFunny * 3 +
    s.verdictsCast * 1 +
    s.updateRequestsGiven * 2 +
    s.arcsFollowed * 2 +
    s.sharesGiven * 2 +
    s.savesGiven * 1 +
    s.currentStreak * 5;
  return Math.min(9999, raw);
}

export function helpfulnessScore(s: ReputationStats): number {
  if (s.commentCount === 0) return 0;
  const ratio = (s.commentLikes + s.commentFunny) / Math.max(1, s.commentCount);
  return Math.min(100, Math.round(ratio * 50 + Math.min(50, s.commentCount)));
}

export function deriveReputationBadges(s: ReputationStats): Badge[] {
  const out: Badge[] = [];
  if (s.commentLikes >= 25 || s.commentFunny >= 15)
    out.push({ id: "tea_therapist", emoji: "☕", label: "Tea Therapist", desc: "Your comments actually help (and crack people up)." });
  if (s.redFlagVotesCast >= 10)
    out.push({ id: "red_flag_detective", emoji: "🚩", label: "Red Flag Detective", desc: "You spot the chaos early." });
  if (s.commentCount >= 20 && s.commentLikes >= 10)
    out.push({ id: "relationship_supporter", emoji: "🫂", label: "Relationship Supporter", desc: "Showing up for people in their messiest moments." });
  if (s.verdictsCast >= 25)
    out.push({ id: "chaos_judge", emoji: "⚖️", label: "Chaos Judge", desc: "25+ verdicts cast. The jury salutes you." });
  if (s.updateRequestsGiven >= 10 || s.arcsFollowed >= 5)
    out.push({ id: "plot_twist_hunter", emoji: "👀", label: "Plot Twist Hunter", desc: "You always need Part 2." });
  if (s.hopeVotesCast >= 10)
    out.push({ id: "hope_restorer", emoji: "❤️", label: "Hope Restorer", desc: "You vote for the green flags." });
  if (s.commentFunny >= 25)
    out.push({ id: "comedy_relief", emoji: "🤣", label: "Comedy Relief", desc: "Your comments live rent-free in the group chat." });
  if (s.sharesGiven >= 15)
    out.push({ id: "town_crier", emoji: "📣", label: "Town Crier", desc: "You make sure the tea travels." });
  if (s.currentStreak >= 7)
    out.push({ id: "loyal_juror", emoji: "🔥", label: "Loyal Juror", desc: `${s.currentStreak}-day streak. Court is in session.` });
  return out;
}
