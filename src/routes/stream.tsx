// Story Stream — single full-viewport surface, no header / nav / sidebar.
// Persistent AliasPill (top-right) + ChatbotPill (bottom-center) live inside
// <StreamShell />. All cards typed by item.type.
import { createFileRoute } from "@tanstack/react-router";
import { StreamShell } from "@/components/stream/StreamShell";

export const Route = createFileRoute("/stream")({
  component: StreamPage,
  head: () => ({
    meta: [
      { title: "Shutap — the stream" },
      { name: "description", content: "One stream. No filters. The bench is watching." },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-md p-8 text-center space-y-3">
      <p className="text-sm" style={{ color: "var(--c-text-2)" }}>
        The stream is between stories.
      </p>
      <p className="text-xs break-words" style={{ color: "var(--c-text-3)" }}>
        {error.message}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-full text-sm"
        style={{ background: "var(--c-pink-soft)", color: "var(--c-pink-ink)" }}
      >
        Reload
      </button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-md p-8 text-center text-sm" style={{ color: "var(--c-text-2)" }}>
      Nothing on the docket.
    </div>
  ),
});

function StreamPage() {
  return <StreamShell />;
}
