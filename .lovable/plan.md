## Goal

Replace the current `/stream` with the spec'd single-surface feed: one full-viewport scroller, typed cards rendered by `item.type`, infinite scroll, pull-to-refresh, plus persistent alias pill and Bench chatbot pill. No header, tabs, sidebar, or bottom nav. the cards in story stream should keep current design in color and fonts, but change horizontal layout to cards like xiaohongshu scrolling. view multiple story cards at the same time. 

A `/stream` route already exists with a sticky header and `StreamBody` rendering a flat list of `FeedStoryCard`s. It does not match the spec and will be rewritten end-to-end. Existing `VerdictBar`, `CourtCaseCard`, `CountdownChip`, and `AliasPill` building blocks will be reused where they match; otherwise replaced.

## Scope decisions (please confirm)

1. **Stream feed source.** Spec mentions `/orchestrator compose`. There is no such endpoint today. I will add one server function `composeStream({ cursor, limit, anonymous })` that mixes types from existing tables (posts → StoryCard, court_cases → CourtCaseCard, hof_scores → HOFCard, bench_voice_strings → BenchMomentCard, plus injected SpillCTA / ScanCTA / ServiceCard slots). A future orchestrator can replace its internals without touching the UI.
2. **ServiceCard content.** Not defined yet. I will render a placeholder "Service" tile that links to a future services route, gated behind a feature flag so it ships dormant.
3. **Pull-to-refresh.** Mobile-first gesture only (touch). On desktop a small "New stories" pill appears when fresh items are available.
4. **Long-press quick actions.** Mobile long-press + desktop right-click both open the same action sheet.

If any of these are wrong, tell me and I will revise before building.

## Plan

### 1. Stream store

- `src/stores/stream.ts` (zustand): `items[]`, `cursor`, `loading`, `chatbot_override_active`, plus actions `prepend`, `append`, `setCursor`, `reset`.

### 2. Server fn: compose stream

- `src/lib/stream.functions.ts` → `composeStream({ data: { cursor?, limit?, anonymous } })`.
- Returns `{ items: StreamItem[], next_cursor: string | null }`.
- `StreamItem` is a discriminated union on `type`: `story | court_case | spill_cta | scan_cta | hof | bench_moment | service`.
- Anonymous: only `court_case`, `hof`, `bench_moment`, `scan_cta`, `service`.
- Authed: full mix, with CTAs sprinkled every ~7 items.

### 3. Card components (`src/components/stream/`)

- `StoryCard.tsx` — surface-2 / 0.5px border / `--r-md`. 4:3 vs 3:4 by index parity. Teal left border when `both_sides_heard`. Alias pill (left) + relationship + category badge (right). 3-line snippet. Score badge (gray/purple/coral/amber bands). Compact `VerdictBar` (6px). Relate + comment counts. `CourtRibbon` overlay if nominated. One-sided disclosure line. Long-press / right-click → action sheet. Tap → `/post/$postId`.
- `CourtCaseCard.tsx` — reuse existing where compatible; otherwise stream variant with `CourtRibbon`.
- `SpillCTACard.tsx`, `ScanCTACard.tsx` — Bench-voice CTA tiles, route to `/spill` / `/scan`.
- `HOFCard.tsx` — surfaces a HOF entry.
- `BenchMomentCard.tsx` — pulls a `bench_voice_strings` line, no actions.
- `ServiceCard.tsx` — dormant placeholder.

### 4. Shared widgets

- `CourtRibbon.tsx` — pill, amber background, 1s countdown tick. Pulse <60min. Coral + faster pulse <10min.
- `RelateButton.tsx` — distinct icon, "N felt this", teal fill when active. Calls `relateToPost` or fires `SoftGate`.
- Rework `VerdictBar` to spec: 7 animated segments, Realtime subscription on `post_verdict_votes` filtered by post_id, user's vote = white 1px outline, compact (6px) / full (32px) variants.
- `AliasPill` — three states (full / reduced / anonymous), surface-3 + pill radius.

### 5. Persistent UI shell

- `src/components/stream/StreamShell.tsx`: full-viewport scroller, fixed `AliasPill` top-right (hidden when anonymous), fixed `ChatbotPill` bottom-center ("Ask The Bench...", text-only).
- `AliasOverlay` and `ChatbotOverlay` mounted lazily on tap. Existing overlays reused if present, else stub scaffolding with the four sections (profile, bookmarks, journal, settings) for alias, and a placeholder chat surface that calls a future `askBench` server fn.

### 6. Stream page

- Rewrite `src/routes/stream.tsx`: no header. Renders `<StreamShell>` with `<StreamList />`.
- `StreamList` uses `useInfiniteQuery` with `composeStream`, page size 20, primes via loader (`ensureInfiniteQueryData`). `IntersectionObserver` sentinel triggers `fetchNextPage`.
- Pull-to-refresh: touch gesture handler invokes `queryClient.resetQueries(['stream'])`, then refetch.

### 7. SoftGate

- Reuse existing soft-gate component if available; otherwise a small `<SoftGate trigger=...>` wrapper that opens a sign-in sheet for anonymous taps on vote / relate / comment / bookmark.

## Technical details

- Realtime: enable publication for `post_verdict_votes` if not already (verify in a migration first; skip if it is).
- `composeStream` is a public server fn using `supabaseAdmin` inside the handler (public reads + safe column projection). Bench-voice copy comes from `bench_voice_strings`.
- All copy goes through the Bench voice rules — no "Loading…", no exclamation marks.
- Score color bands implemented as a `scoreTone(score)` helper returning a CSS variable name.
- Long-press: `pointerdown` 450ms timer; cancelled on `pointermove` / `pointerup`. Right-click `onContextMenu` opens the same sheet.
- Infinite scroll: cursor encoded as `${published_at}|${id}` for stability.
- Anonymous detection: `supabase.auth.getSession()` (client) + `anonymous` flag passed to `composeStream` so SSR returns the right mix.

## Out of scope (later steps)

- Real `/orchestrator compose` mixing logic (current server fn is the seam).
- Bench chatbot reply pipeline (overlay ships with input + scaffold).
- Journal feature inside the alias overlay (link only).
- Service catalogue (`ServiceCard` is placeholder).

Confirm the four scope decisions above and I will build straight through.