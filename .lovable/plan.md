# Shutap — Optimization & Stability Plan

The app is functionally rich (35 routes, 86 components, 16 server-fn modules) but most performance and bug risk comes from a few systemic patterns. This plan fixes the highest-leverage ones first, then sets up guardrails so new bugs don't pile up.

## What's hurting us today (evidence from the codebase)

- **Only 1 of 35 routes uses a loader.** Everything else fetches client-side via `useQuery` / `useEffect` after the page paints → blank screens, layout shift, double round-trips, no SSR for SEO.
- **No `errorComponent` on most routes.** A single failed query blanks the page or throws to root.
- **Framer-motion imported in 28 files.** Mostly micro-animations; ships ~80 KB gzipped to every route.
- **Wide SELECTs in feed/profile queries** (no column projection — pulls the 33-col profiles row, 32-col posts row even for cards).
- **No `useMemo`/`memo` on feed cards or comment threads** — the stream re-renders the whole list on any reaction/vote.
- **No composite DB indexes** on the hot paths: `posts(visibility, status, deleted_at, published_at)`, `post_comments(post_id, created_at)`, `notifications(user_id, created_at)`, `post_reactions(post_id, user_id)`, `follows(follower_id)` etc. Today these scan.
- **No image optimization.** `story-media` bucket served raw at full resolution.
- **AI calls block UI.** Spill scoring + scan run synchronously without streaming.
- **No request budget / timeout** on Lovable AI calls — a slow upstream hangs the route forever.

## The plan, in priority order

### Phase 1 — Stop the bleeding (biggest win, lowest risk)

1. **Convert top-traffic routes to the loader+Query pattern** (`/`, `/court`, `/post/$postId`, `/u/$handle`, `/_authenticated/me`, `/_authenticated/friends`, `/_authenticated/profile/scans`). Loader primes `queryClient.ensureQueryData`; component reads with `useSuspenseQuery`. Removes spinners on first paint and makes share links SSR-correct.
2. **Add `errorComponent` + `notFoundComponent` to every route with a loader.** A failed RPC shows a Bench-voice card with a retry that calls `router.invalidate()`, not a blank page.
3. **Project explicit columns** in every server-fn select. No more `select("*")` on `profiles` / `posts`. Card queries return ~8 fields, detail queries return the full set.
4. **Add the missing composite indexes** in one migration. Estimated 5-50x speedup on feed, comments, notifications, court list.

### Phase 2 — Render performance

5. **Memoize the feed/comment/notification list items** (`React.memo` + stable keys + `useCallback` for handlers). Stops the whole stream from re-rendering on a single like.
6. **Lazy-load framer-motion-heavy components** below the fold (`React.lazy` for `ScoreReveal`, `StoryArc`, `VerdictBar`, court animations). The home and post pages don't need them at first paint.
7. **Replace one-off `motion.div` wrappers** that animate only opacity/transform with a single shared CSS keyframe utility. Cuts framer usage in ~15 files.
8. **Image pipeline.** Add a `/api/img/$` server route that proxies `story-media` through Cloudflare Image Resizing (width, format=auto). Update `AvatarSvg` / `FeedCard` to request the right size.

### Phase 3 — AI & long-running calls

9. **Set a 15s hard timeout on Lovable AI calls**, return a typed `{ error }` fallback, and surface a Bench-voice retry. No more hung routes.
10. **Stream spill scoring & scan** (server route returning SSE) so the user sees tokens immediately instead of waiting 8-15s for a final payload.
11. **Move analytics writes** (`post_views`, `story_interactions`) off the render path — fire-and-forget from `useEffect`, not from the loader.

### Phase 4 — Guardrails (stops future regressions)

12. **ESLint rules**:
    - Ban `useEffect` + `supabase.from(` (forces server-fn use).
    - Ban `select("*")` on a Supabase chain.
    - Ban `from "framer-motion"` outside an allow-list of animation-owning components.
    - Ban `console.log` in `src/` (already clean; lock it in).
13. **A `loader-required` lint** for route files matching a list of "shareable" patterns (`post.*`, `u.*`, `court.*`) — must have `loader` and `head`.
14. **A pre-merge CI script** that runs `tsc --noEmit`, `eslint`, and `bunx vite build` so broken routes never reach preview.
15. **Add a `?` debug overlay** (dev only) that shows the active route, loader status, queryClient hits/misses, and bundle size of the current chunk. Makes future perf work measurable.

### Phase 5 — Database hygiene

16. **Add the validation triggers** the project rule prefers over CHECK (e.g. `dob ≤ now() - 18y`).
17. **`pg_stat_statements` review** — pick the top 10 slowest statements and either add an index, project columns, or push them into a `SECURITY DEFINER` function.
18. **Auto-vacuum tuning** for `post_views` and `notifications` (write-heavy, churn fast).

## Technical notes

- Loader+Query canonical shape (per `tanstack-query-integration`):
  ```ts
  const opts = queryOptions({ queryKey: ["post", id], queryFn: () => getPost({ data: { id } }) });
  export const Route = createFileRoute("/post/$postId")({
    loader: ({ context, params }) => context.queryClient.ensureQueryData(opts(params.postId)),
    component: PostPage,
    errorComponent: PostError,
    notFoundComponent: PostMissing,
    head: ({ loaderData }) => ({ meta: [{ title: loaderData?.title }, ...] }),
  });
  ```
- Authenticated loaders only under `_authenticated/` (route gate is integration-managed).
- Indexes go in one migration with `CREATE INDEX CONCURRENTLY` so it's online.
- Image proxy MUST allow-list `story-media` host only (SSRF guard per `perf` rules).
- Framer lazy-load uses `React.lazy` + `<Suspense fallback={null} />` — no layout shift because parent reserves height.

## Scope decisions I need from you

A. **How aggressive on Phase 1?** Top 7 routes (proposed), all 35, or just the public shareable ones (`/`, `/post/$postId`, `/u/$handle`, `/court`)?

B. **Image pipeline:** wire Cloudflare Image Resizing now, or just add `?width=` query-string + `<img sizes="...">` and defer the proxy?

C. **AI streaming:** ship streaming for spill + scan, or just the timeout + fallback for now?

D. **Lint guardrails:** add them now (some legitimate violations will need fixing) or after Phase 1-3 lands?

Reply with letters + choice (e.g. "A: top 7, B: defer, C: timeout only, D: now") and I'll execute.