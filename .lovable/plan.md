
# Wire The Bench — 7-Prompt AI Library

Implement the full prompt library as a server-side module and wire every trigger into the existing Spill / Scan / Court / Post flows.

## 1. Prompt module

New file: `src/lib/bench/bench-prompts.server.ts`
- Export `VOICE_PRIMER` constant + 7 typed prompt builders (`buildSeedReaction`, `buildScanCard`, `buildObjection`, `buildPromotion`, `buildOverturned`, `buildFollowUp`, `buildSafetyRouter`).
- Each returns `{ system, user }` strings.
- Add per-prompt output Zod schemas (`SeedReactionSchema`, etc.) for safe JSON parsing.

New file: `src/lib/bench/bench-runner.server.ts`
- Single `runBenchPrompt(name, input)` helper that:
  - Calls Lovable AI Gateway via existing `createLovableAiGatewayProvider`.
  - Uses `google/gemini-3-flash-preview` for high-volume (1,2,4) and `google/gemini-2.5-pro` for stronger (3,5,6) and `7` (safety).
  - Parses JSON, validates with schema, returns typed result.
  - Logs into `ai_call_log`.

## 2. Server functions

New file: `src/lib/bench/bench.functions.ts` — `createServerFn` wrappers:
- `runSafetyRouter({ caseText })` — Prompt 7. Public/auth as needed.
- `seedBenchReaction({ postId })` — Prompt 1; one-shot per post (idempotency via `posts.bench_seed_lean` column).
- `runScanCard({ scanId })` — Prompt 2; writes to `scan_results`.
- `runObjection({ postId, objectionText })` — Prompt 3; hard-cap 1 call/post via DB unique check.
- `runCourtPromotion({ postId })` — Prompt 4.
- `runOverturnedRecap({ caseId })` — Prompt 5.
- `runFollowUp({ postId })` — Prompt 6.

All admin-bearing writes use `supabaseAdmin` loaded inside handler.

## 3. Database migration

Add columns + tables to support the new writes:

```sql
ALTER TABLE posts
  ADD COLUMN bench_seed_lean text,
  ADD COLUMN bench_seed_verdict_tag text,
  ADD COLUMN bench_seed_comment text,
  ADD COLUMN bench_seed_at timestamptz,
  ADD COLUMN bench_objection_used boolean DEFAULT false,
  ADD COLUMN bench_objection_response jsonb,
  ADD COLUMN bench_overturned_outcome text,
  ADD COLUMN bench_overturned_comment text,
  ADD COLUMN safety_risk_type text,
  ADD COLUMN safety_blocked boolean DEFAULT false;

ALTER TABLE scan_results
  ADD COLUMN bench_label text,
  ADD COLUMN bench_read text,
  ADD COLUMN bench_share_line text,
  ADD COLUMN bench_lean text;

CREATE TABLE public.bench_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL UNIQUE,
  comment text NOT NULL,
  cta_label text NOT NULL,
  shown_at timestamptz,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.bench_followups TO authenticated;
GRANT ALL  ON public.bench_followups TO service_role;
ALTER TABLE public.bench_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads followup"
  ON public.bench_followups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND p.author_id = auth.uid()));
```

## 4. Trigger wiring

**Prompt 7 (Safety) — runs first, always**
- Inject into `src/lib/spill.functions.ts` (`createDraft`/finalize) and `src/lib/scan.functions.ts` (any free-text submission). If `block_normal_processing=true`: write `safety_blocked=true`, store `response_comment`, return early; do NOT publish post / continue scoring; skip Prompts 1–6.

**Prompt 1 (Seed)** — after successful publish in `src/lib/posts/manage.functions.ts` publish path (and `src/lib/spill.functions.ts` finalize). Idempotent on `bench_seed_at IS NULL`. Result seeds the verdict bar (read via existing verdict tally endpoint — extend `src/routes/api/public/verdict-tally.ts` to include `bench_seed_*` as a 1-vote synthetic seed).

**Prompt 2 (Scan card)** — at end of `src/lib/scan.functions.ts` finalize path, after the existing score. Writes to `scan_results.bench_*`. Render on `src/routes/_authenticated/scan/result.$scanId.tsx`.

**Prompt 3 (Objection)** — new UI affordance "Object" on the seed comment on `src/routes/post.$postId.tsx` (author-only, hidden if `bench_objection_used`). Calls `runObjection`; renders ruling inline; UI closes thread after one reply. Backend rejects second call.

**Prompt 4 (Court promotion)** — extend `src/lib/nomination.functions.ts` (or post engagement hook) where the felt/relate threshold check lives; on cross, call `runCourtPromotion` and store on `court_cases` (use existing `bench_line` column if present; else stuff into `notes`/dedicated column — verify before writing).

**Prompt 5 (Overturned recap)** — extend `src/lib/court/flipWindow.server.ts` lock path. After final tally, compare `posts.bench_seed_lean` vs computed majority; call `runOverturnedRecap`; store result on post; if `overturned`, insert HOF nomination row (`hof_nominations` with type `bench_overturned`).

**Prompt 6 (Follow-up)** — new public webhook `src/routes/api/public/hooks/bench-followups.ts` to be called by pg_cron (existing pattern). Selects locked posts 14+ days past verdict with no outcome and no row in `bench_followups`; runs Prompt 6 per post; inserts row. Surfaced on `_authenticated/me.tsx` as a card.

## 5. UI touches

- `src/components/posts/VerdictBar.tsx` — render Bench seed as a labeled "first read" pill (not as a real vote).
- `src/routes/post.$postId.tsx` — add "Object" button + objection result block.
- `src/routes/_authenticated/scan/result.$scanId.tsx` — render Bench label + share_line on the share card.
- `src/components/stream/StoryCard.tsx` — show the seed `comment` under new posts before vote count grows.
- `src/routes/_authenticated/me.tsx` — show pending bench follow-ups.

## 6. Safety hard rules

- `runSafetyRouter` is called inside every Spill/Scan submission handler before any other Bench call. Centralized in a tiny helper `assertSafePost(text)` that throws a typed `SafetyBlocked` error caught by callers to short-circuit publish + skip prompts 1–6.
- No client-side bypass.

## 7. Verification

- Build + targeted edits, then publish a new test Spill and confirm: seed appears immediately; objection limited to one; lock path produces recap; safety-flagged text never reaches the stream.

## Technical notes

- Models: 1/2/4 → `google/gemini-3-flash-preview`; 3/5/6/7 → `google/gemini-2.5-pro`.
- All prompts return JSON-only; validated with Zod; on parse failure, log + fall back gracefully (skip writing) — but for safety router, fail closed (treat as blocked).
- Reuse existing `ai_call_log` table.
- Reuse existing `createLovableAiGatewayProvider` helper if present, else create at `src/lib/ai-gateway.server.ts`.
