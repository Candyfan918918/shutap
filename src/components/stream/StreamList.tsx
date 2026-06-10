// StreamList — masonry-ish 2-column infinite scroll with pull-to-refresh.
// One source of truth: useInfiniteQuery on composeStream. Items are kept in
// the zustand stream store so the chatbot overlay / overlays can read them.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { composeStream, type StreamItem } from "@/lib/stream.functions";
import { StoryCard } from "./StoryCard";
import { CourtCaseCard } from "./CourtCaseCard";
import { SpillCTACard, ScanCTACard, ServiceCard, HOFCard, BenchMomentCard } from "./Cards";

interface Props {
  anonymous: boolean;
}

const PAGE_SIZE = 20;

export function StreamList({ anonymous }: Props) {
  const compose = useServerFn(composeStream);
  const qc = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ["stream", anonymous ? "anon" : "auth"] as const,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      (compose as unknown as (a: { data: any }) => Promise<{ items: StreamItem[]; next_cursor: string | null }>)(
        { data: { cursor: pageParam, limit: PAGE_SIZE, anonymous } },
      ),
    getNextPageParam: (last) => last.next_cursor,
    staleTime: 30_000,
  });

  const items: StreamItem[] = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.items),
    [query.data],
  );

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
            void query.fetchNextPage();
          }
        }
      },
      { rootMargin: "320px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [query]);

  // Pull-to-refresh (touch only)
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
  }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setPull(Math.min(96, dy * 0.5));
  }, []);
  const onTouchEnd = useCallback(async () => {
    const triggered = pull > 64;
    startY.current = null;
    setPull(0);
    if (triggered && !refreshing) {
      setRefreshing(true);
      try {
        await qc.resetQueries({ queryKey: ["stream", anonymous ? "anon" : "auth"] });
        await query.refetch();
      } finally {
        setRefreshing(false);
      }
    }
  }, [pull, refreshing, qc, query, anonymous]);

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="w-full"
    >
      {/* Pull indicator */}
      <div
        aria-hidden
        className="flex items-center justify-center text-[11px] transition-all"
        style={{
          height: pull,
          color: "var(--c-text-3)",
          opacity: pull > 16 ? 1 : 0,
        }}
      >
        {refreshing ? "The bench reshuffles." : pull > 64 ? "release to refresh" : "pull"}
      </div>

      {/* Masonry — Xiaohongshu style. 2 cols mobile, 2 tablet, 3 desktop. */}
      <div
        className="px-3 pt-2 pb-32"
        style={{ columnGap: "12px", columnCount: 2 }}
      >
        <style>{`
          @media (min-width: 768px) { .stream-cols { column-count: 2 !important; } }
          @media (min-width: 1024px) { .stream-cols { column-count: 3 !important; } }
          .stream-cell { break-inside: avoid; margin-bottom: 12px; display: block; }
        `}</style>
        <div className="stream-cols" style={{ columnGap: "12px", columnCount: 2 }}>
          {items.map((item, idx) => (
            <div key={item.key} className="stream-cell">
              {renderItem(item, idx, anonymous)}
            </div>
          ))}
        </div>
      </div>

      {/* Sentinel + loading line */}
      <div ref={sentinelRef} className="h-10" />
      {query.isFetchingNextPage && (
        <p className="text-center text-[11px] pb-6" style={{ color: "var(--c-text-3)" }}>
          The bench keeps reading.
        </p>
      )}
      {!query.hasNextPage && items.length > 0 && (
        <p className="text-center text-[11px] pb-10" style={{ color: "var(--c-text-3)" }}>
          That's the docket. Come back tomorrow.
        </p>
      )}
      {items.length === 0 && !query.isLoading && (
        <p className="text-center text-[12px] pt-12 pb-6" style={{ color: "var(--c-text-3)" }}>
          The room is quiet. The bench waits.
        </p>
      )}
    </div>
  );
}

function renderItem(item: StreamItem, idx: number, anonymous: boolean) {
  switch (item.type) {
    case "story":
      return <StoryCard payload={item.payload} index={idx} anonymous={anonymous} />;
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
