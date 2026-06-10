// BenchResponseCard — pinned to top of stream when chatbot has overridden it.
import { useStreamStore } from "@/stores/stream";

export function BenchResponseCard() {
  const response = useStreamStore((s) => s.override_response);
  const clearOverride = useStreamStore((s) => s.clearOverride);
  if (!response) return null;
  return (
    <div
      className="relative mx-2 sm:mx-3 mt-2 mb-3 p-4"
      style={{
        background: "var(--c-surface-2, #f6f3ec)",
        borderLeft: "2px solid var(--c-purple, #6d4ec9)",
        borderRadius: "var(--r-md, 14px)",
      }}
    >
      <p
        className="text-[10px] uppercase tracking-[0.1em] mb-1"
        style={{ color: "var(--c-text-3)" }}
      >
        The Bench
      </p>
      <p
        className="text-[14px] leading-snug pr-16"
        style={{ color: "var(--c-text-1)", fontWeight: 500 }}
      >
        {response}
      </p>
      <button
        type="button"
        onClick={clearOverride}
        className="absolute bottom-3 right-3 text-[11px] px-3 h-7 rounded-full"
        style={{ background: "var(--c-surface-3, #e3ddd2)", color: "var(--c-text-2)" }}
      >
        Clear
      </button>
    </div>
  );
}
