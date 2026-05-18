// Compact identity pill for headers/sidebars.
import { AvatarSvg } from "./AvatarSvg";

export function IdentityBadge({
  displayName,
  avatarUrl,
  onClick,
}: {
  displayName: string;
  avatarUrl: string;
  onClick?: () => void;
}) {
  const content = (
    <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-surface-elevated/80 border border-border max-w-[180px]">
      <AvatarSvg src={avatarUrl} size={28} className="shadow-none" alt="" />
      <span className="text-xs font-semibold truncate">{displayName}</span>
    </span>
  );
  if (!onClick) return content;
  return (
    <button type="button" onClick={onClick} className="hover:opacity-90 transition">
      {content}
    </button>
  );
}
