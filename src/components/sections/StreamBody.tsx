// Story Stream body — landing-page preview embed of the /stream surface.
// Uses the same composeStream pipeline + typed cards as /stream, but in a
// finite (single-page) masonry preview. Pull-to-refresh and infinite scroll
// live on the real /stream route.
import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { composeStream, type StreamItem } from "@/lib/stream.functions";
import { StoryCard } from "@/components/stream/StoryCard";
import { CourtCaseCard } from "@/components/stream/CourtCaseCard";
import {
  SpillCTACard,
  ScanCTACard,
  ServiceCard,
  HOFCard,
  BenchMomentCard,
} from "@/components/stream/Cards";

const PREVIEW_LIMIT = 12;

export function StreamBody() {
  const compose = useServerFn(composeStream);
  const feedQ = useQuery({
    queryKey: ["home-stream", "preview"],
    queryFn: () =>
      (compose as unknown as (a: { data: any }) => Promise<{
        items: StreamItem[];
        next_cursor: string | null;
      }>)({ data: { cursor: null, limit: PREVIEW_LIMIT, anonymous: true } }),
    staleTime: 30_000,
  });

  const items: StreamItem[] = useMemo(() => feedQ.data?.items ?? [], [feedQ.data]);

  return (
    <>
      {/* Stream hero — cream + pink-deep, matches Court */}
      <section className="relative overflow-hidden text-center px-4 pt-6 pb-5 bg-c-surface-2 border-b border-c-border">
        <span
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 top-[-10px] text-[88px] font-medium text-c-pink-soft/70 whitespace-nowrap pointer-events-none tracking-tighter select-none"
        >
          STREAM
        </span>
        <div className="relative text-[10px] font-medium tracking-[0.12em] uppercase text-c-pink-deep mb-2">
          The Stream · One feed. No filters.
        </div>
        <h1 className="relative text-[16px] font-medium text-c-text-1 leading-snug mb-1.5 text-balance">
          Today's stories. In the order the Bench thinks you need them.
        </h1>
        <p className="relative text-[12px] italic text-c-text-2 leading-snug">
          Read. Weigh in. Move on.
        </p>
      </section>

      <div
        className="px-3 pt-3 pb-4"
        style={{ columnGap: "10px", columnCount: 2 }}
      >
        <style>{`
          @media (min-width: 640px) { .stream-cols-preview { column-count: 3 !important; } }
          .stream-cols-preview { column-gap: 10px; column-count: 2; }
          .stream-cell-preview { break-inside: avoid; margin-bottom: 10px; display: block; }
        `}</style>

        {items.length === 0 ? (
          <p
            className="text-center text-[12px] py-10"
            style={{ color: "var(--c-text-3)" }}
          >
            {feedQ.isLoading ? "The bench composes the docket." : "The room is quiet. The bench waits."}
          </p>
        ) : (
          <div className="stream-cols-preview">
            {items.map((item, idx) => (
              <div key={item.key} className="stream-cell-preview">
                {renderItem(item, idx)}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function renderItem(item: StreamItem, idx: number) {
  switch (item.type) {
    case "story":
      return <StoryCard payload={item.payload} index={idx} anonymous={true} />;
    case "court_case":
      return <CourtCaseCard payload={item.payload} index={idx} />;
    case "spill_cta":
      return <SpillCTACard headline={item.payload.headline} sub={item.payload.sub} index={idx} />;
    case "scan_cta":
      return <ScanCTACard headline={item.payload.headline} sub={item.payload.sub} index={idx} />;
    case "service":
      return <ServiceCard headline={item.payload.headline} sub={item.payload.sub} index={idx} />;
    case "hof":
      return <HOFCard payload={item.payload} index={idx} />;
    case "bench_moment":
      return <BenchMomentCard line={item.payload.line} index={idx} />;
  }
}
