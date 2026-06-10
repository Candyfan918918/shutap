// Lightweight CTA + meta cards for the stream.
import { Link } from "@tanstack/react-router";
import type { HofPayload } from "@/lib/stream.functions";

function CtaShell({
  to,
  badge,
  headline,
  sub,
  bg,
  index,
}: {
  to: string;
  badge: string;
  headline: string;
  sub: string;
  bg: string;
  index: number;
}) {
  const isPortrait = index % 2 === 0;
  const aspect = isPortrait ? "3/4" : "4/3";
  return (
    <Link
      to={to as any}
      className="flex flex-col overflow-hidden transition active:scale-[0.995] p-4"
      style={{
        background: bg,
        borderRadius: "var(--r-md, 14px)",
        border: "0.5px solid var(--c-border, #e3ddd2)",
        aspectRatio: aspect,
      }}
    >
      <span
        className="self-start px-2 h-5 inline-flex items-center text-[9.5px] font-semibold uppercase tracking-[0.05em] rounded-full"
        style={{ background: "rgba(0,0,0,0.07)", color: "var(--c-text-1)" }}
      >
        {badge}
      </span>
      <p
        className="mt-3 text-[15px] font-medium leading-snug flex-1"
        style={{ color: "var(--c-text-1)" }}
      >
        {headline}
      </p>
      <p className="text-[12px] mt-1" style={{ color: "var(--c-text-2)" }}>
        {sub}
      </p>
    </Link>
  );
}

export function SpillCTACard({
  headline,
  sub,
  index,
}: { headline: string; sub: string; index: number }) {
  return (
    <CtaShell
      to="/spill"
      badge="Spill"
      headline={headline}
      sub={sub}
      bg="var(--c-pink-soft, #ffe6ef)"
      index={index}
    />
  );
}

export function ScanCTACard({
  headline,
  sub,
  index,
}: { headline: string; sub: string; index: number }) {
  return (
    <CtaShell
      to="/scan"
      badge="Scan"
      headline={headline}
      sub={sub}
      bg="var(--c-purple-soft, #ece5fa)"
      index={index}
    />
  );
}

export function ServiceCard({
  headline,
  sub,
  index,
}: { headline: string; sub: string; index: number }) {
  return (
    <CtaShell
      to="/"
      badge="Service"
      headline={headline}
      sub={sub}
      bg="var(--c-teal-soft, #d8efe9)"
      index={index}
    />
  );
}

export { HofStreamCard as HOFCard } from "@/components/hof/HofStreamCard";

export function BenchMomentCard({ line, index }: { line: string; index: number }) {
  const isPortrait = index % 2 === 0;
  const aspect = isPortrait ? "3/4" : "4/3";
  return (
    <div
      className="flex flex-col justify-center p-5"
      style={{
        background: "var(--c-surface-1, #fff)",
        borderRadius: "var(--r-md, 14px)",
        border: "0.5px dashed var(--c-border)",
        aspectRatio: aspect,
      }}
    >
      <span
        className="self-start mb-2 px-2 h-5 inline-flex items-center text-[9.5px] font-semibold uppercase tracking-[0.05em] rounded-full"
        style={{ background: "var(--c-surface-3)", color: "var(--c-text-2)" }}
      >
        The Bench
      </span>
      <p
        className="text-[13px] italic leading-snug"
        style={{ color: "var(--c-text-1)" }}
      >
        "{line}"
      </p>
    </div>
  );
}
