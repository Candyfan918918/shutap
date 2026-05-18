// Creates a new scan and redirects into the first question.
import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { startScan } from "@/lib/scan.functions";
import { detectBrowserLocale, isLocale } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/scan/start")({
  component: ScanStart,
});

function ScanStart() {
  const navigate = useNavigate();
  const start = useServerFn(startScan);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    (async () => {
      try {
        const stored = typeof window !== "undefined" ? localStorage.getItem("md.locale") : null;
        const locale = isLocale(stored) ? stored : detectBrowserLocale();
        const scan = await start({ data: { locale } });
        navigate({
          to: "/scan/question/$step",
          params: { step: "0" },
          search: { scanId: scan.id },
          replace: true,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not start scan");
        navigate({ to: "/scan", replace: true });
      }
    })();
  }, [start, navigate]);

  return (
    <div className="min-h-screen grid place-items-center text-muted-foreground">
      Preparing your scan…
    </div>
  );
}
