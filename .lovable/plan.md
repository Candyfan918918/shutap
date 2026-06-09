# Court System — Out-of-Scope Wrap-Up

Five independent feature areas. Each ships as its own slice.

## 1. Admin tooling for city court toggles

**DB:** `city_courts` already exists. Add `is_enabled bool`, `nomination_cap int`, `paused_reason text`, `updated_by uuid`. RLS: admins only (via `has_role(uid,'admin')`).

**Server:**
- `src/lib/admin/cityCourts.functions.ts` — `listCityCourts`, `toggleCityCourt({code, enabled, reason})`, `updateCityCourtConfig({code, cap})`. All `.middleware([requireSupabaseAuth])` + admin role check.

**UI:** `src/routes/_authenticated/admin.tsx` (gated by role) → table of city courts with toggle switches, cap input, pause reason. Updated nomination engine (`court-tick.ts`) checks `is_enabled` before scheduling nominations per city.

## 2. Re-vote / flip window when bothSidesHeard flips

**DB:** add `flip_window_opened_at timestamptz`, `flip_window_closes_at timestamptz`, `pre_flip_verdict text` to `court_cases`. Vote table gets `flip_round int default 1`.

**Logic:** when a verified responder posts a perspective after the bench verdict is generated (`court_cases.status='decided'` and `both_sides_heard` flips from false→true), trigger `openFlipWindow(caseId)` from `perspectives.functions.ts`:
- snapshot current verdict into `pre_flip_verdict`
- set `flip_window_closes_at = now() + 6h`
- reset case status back to `in_court` (flagged `is_flip_round=true`)
- notify all prior voters: "New evidence dropped — re-vote open for 6h"

`court-tick.ts` finalizes flip rounds the same way as normal closes but writes a `verdict_flipped` event into `reputation_events` and adjusts juror scores (correct on flip = bonus).

**UI:** `CourtCaseCard` + `CourtroomPanel` show a "Flip Round Active" ribbon, countdown, and "Your previous vote: X — change?" CTA.

## 3. Mod queue for paused candidacy

**DB:** new `mod_queue` table — `case_id`, `post_id`, `reason` (enum: `pii_suspected`, `mass_flag`, `legal_risk`, `manual_hold`), `status` (`pending|approved|rejected`), `moderator_id`, `notes`, `resolved_at`.

**Triggers into queue:**
- `nomination.functions.ts`: if rate-limit or PII scan flags post → insert into `mod_queue` with status `pending`, pause `court_cases.status='paused'`.
- Manual: admin endpoint `pauseCandidacy({caseId, reason})`.

**Server:** `src/lib/admin/modQueue.functions.ts` — `listQueue`, `resolveQueueItem({id, decision, notes})`. On approve → unpause case (status back to `nominated`). On reject → mark `court_cases.status='rejected'`, notify author with Bench voice copy.

**UI:** `src/routes/_authenticated/admin.mod-queue.tsx` (admin/mod role) — list with post preview, reason, approve/reject buttons.

## 4. Per-case OG image generation

**Approach:** lazy, on-demand SSR endpoint, cached to Supabase Storage.

**Endpoint:** `src/routes/api/public/og/case.$caseId.ts` (GET). Flow:
1. Lookup `court_cases` + post (title, region, tier, verdict).
2. Check `story-media/og/case-{caseId}-{verdictHash}.png` exists → 302 to public URL.
3. Otherwise call Lovable AI Gateway `images/generations` with template prompt (Bench voice headline + region label + verdict icon). Upload to storage via `supabaseAdmin`. Return 302.

**Wire:** `post.$postId.tsx` `head()` sets `og:image` to `/api/public/og/case/{caseId}` when the post has a court case. Twitter card matches.

## 5. Multi-language Bench voice variants

**Scope:** translate all canonical Bench strings + verdict summaries.

**DB:** `bench_voice_strings` table — `key text`, `locale text`, `text text`, PK `(key, locale)`. Seed `en` from existing constants in `agent-prompts.server.ts`.

**Locales (phase 1):** `en`, `es`, `pt-BR`, `fr`, `de`, `it`, `pl`, `tr`.

**Server:**
- `src/lib/i18n/bench.server.ts` — `t(key, locale, vars)` with fallback chain `locale → base lang → en`. Cached in-memory per worker.
- Agent prompts updated to receive `locale` and emit summaries in that language (system prompt: "Respond in {locale}. Tone is Bench: declarative, dry, occasionally savage, never cruel.").
- `finalize_court_cases` SQL fn: stop hardcoding English summaries — instead store `verdict_kind` + `pct` only. Render display string client-side via `t()`.

**Client:** `useBenchVoice(locale)` hook reads profile `locale` (already on `profiles`). Replace hardcoded strings in `WatchParty`, `CourtCaseCard`, `OutcomePrompt`, etc.

**Migration risk:** existing `court_cases.ai_summary` rows stay English — kept as fallback; new rows render dynamically.

---

## Build order

1. Migration bundle (all 4 schema sets in one approval) — city_courts columns, court_cases flip cols, mod_queue, bench_voice_strings.
2. Admin role gate + admin layout route.
3. City court admin UI.
4. Mod queue end-to-end.
5. Flip window logic + UI ribbon.
6. OG image endpoint.
7. Bench i18n table + client/server wiring.

Approx 18–22 new files, 6 edits.

Confirm and I'll start with the migration.