// Visibility chip for posts.
import { Globe, Lock, Users } from "lucide-react";

const map = {
  public: { icon: Globe, label: "public", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  private: { icon: Lock, label: "private", className: "bg-zinc-500/10 text-zinc-300 border-zinc-500/30" },
  friends: { icon: Users, label: "friends only", className: "bg-violet-500/10 text-violet-300 border-violet-500/30" },
} as const;

export function VisibilityBadge({ visibility }: { visibility: "public" | "private" | "friends" }) {
  const cfg = map[visibility];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${cfg.className}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}
