import { Button } from "@/components/ui/button";

export type SafetyVariant = "abuse" | "self_harm";

interface SafetyBannerProps {
  variant: SafetyVariant;
}

const CONFIG: Record<
  SafetyVariant,
  {
    headline: string;
    body: string;
    cta: string;
    href: string;
  }
> = {
  abuse: {
    headline: "What you're describing sounds really hard.",
    body: "If any of this involves feeling unsafe, you deserve real support — not just internet opinions.",
    cta: "Find support resources",
    href: "https://www.thehotline.org",
  },
  self_harm: {
    headline: "We read what you shared. Before the internet weighs in, please know help is available right now.",
    body: "",
    cta: "Talk to someone",
    href: "https://988lifeline.org",
  },
};

export function SafetyBanner({ variant }: SafetyBannerProps) {
  const cfg = CONFIG[variant];

  return (
    <div className="rounded-2xl p-5 border border-amber-200/60 bg-amber-50/80 text-amber-900">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none mt-0.5 shrink-0" aria-hidden="true">
          💛
        </span>
        <div className="flex-1 space-y-2.5">
          <div>
            <p className="font-display text-base leading-snug text-balance">
              {cfg.headline}
            </p>
            {cfg.body && (
              <p className="mt-1.5 text-sm leading-relaxed text-amber-800/80">
                {cfg.body}
              </p>
            )}
          </div>
          <Button
            asChild
            size="sm"
            className="bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-200/80 shadow-none"
          >
            <a
              href={cfg.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {cfg.cta}
            </a>
          </Button>
          {variant === "self_harm" && (
            <p className="text-[11px] text-amber-800/60">
              International help:{" "}
              <a
                href="https://findahelpline.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-amber-900"
              >
                findahelpline.com
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface RiskBannerShellProps {
  abuseRisk?: "none" | "possible" | "likely";
  selfHarmRisk?: "none" | "possible" | "likely";
}

export function RiskBanners({ abuseRisk, selfHarmRisk }: RiskBannerShellProps) {
  const showAbuse = abuseRisk === "possible";
  const showSelfHarm = selfHarmRisk === "possible";

  if (!showAbuse && !showSelfHarm) return null;

  return (
    <div className="space-y-3">
      {showAbuse && <SafetyBanner variant="abuse" />}
      {showSelfHarm && <SafetyBanner variant="self_harm" />}
    </div>
  );
}
