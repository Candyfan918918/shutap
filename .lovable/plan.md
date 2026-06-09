# Court System — Alignment Plan

The canonical spec is far larger than the current schema (`court_cases` has scope/region/status only, no tiers, category, lock time, or bench line; no nomination scoring; no predictions/outcomes/wisdom graph; partial perspectives just landed). Building it all in one shot would mean 8+ tables, 5 agents, ~15 server fns and major UI churn. I will ship it in 5 reviewable phases, each independently usable. Each phase ends with a smoke test before the next migration goes up.

## Phase 1 — Schema foundation

Single migration adds the missing core columns / tables. No UI yet.

- `posts`: `nomination_score numeric`, `weighted_vote_sum numeric`, `controversy_score numeric`, `candidacy_paused bool`, `cool_down_until timestamptz`, `expiry_at timestamptz`, `drama_score int`, `prediction_options jsonb`, `relate_count int`.
- `court_cases` additions: `current_tier text check in (city|regional|national|world)`, `current_category_court text`, `verdict_lock_at timestamptz`, `bench_verdict_line text`, `final_judgment text`, `candidacy_paused bool`. Keep legacy `scope/region_*` for backwards compat; map `scope→current_tier` in a one-time UPDATE.
- New tables: `court_tiers` (case_id, tier, started_at, vote_count, ended_at), `city_courts` (code, label, country_code, active), `verdict_weights` view, `predictions`, `prediction_results`, `story_outcomes`, `outcome_reminders` (already exists — verify), `wisdom_graph_nodes`, `wisdom_graph_edges`, `reputation_events`.
- Verdict weight stored on `post_verdict_votes.weight` (add column) — computed server-side at vote time.
- All new public tables follow the four-step GRANT pattern; service-role-only tables (`reputation_events`, wisdom graph writes, `story_tags` already) get no anon/auth grants.

## Phase 2 — Nomination + tier engine (server only)

- `src/lib/nomination.functions.ts`
  - `recalcNomination(postId)` — computes `nomination_score` per formula in spec; writes to `posts`.
  - `checkNomination(postId)` — if score > p95 of live pool AND no `court_cases` row AND not paused → call `court/nominate`.
  - Invoked from existing vote/relate/comment/perspective server fns (one line each).
- `court.functions.ts` additions:
  - `nominate(postId)` — computes entry tier from vote geo distribution + category from `story_tags.category` → writes `court_cases` + initial `court_tiers` row + plaintiff notification.
  - `lockCase(caseId)` — runs at `verdict_lock_at`: computes final_verdict/final_judgment, calls Bench agent for `bench_verdict_line`, fans out push notifications, runs escalation check.
  - `escalateCase(caseId)` — writes new `court_tiers` row, updates `current_tier` + `verdict_lock_at`.
- New Bench agent prompt `bench_verdict_writer` in `agent-prompts.server.ts`; orchestrator moment `court_verdict_lock` → `[bench_verdict_writer]`.
- Cron-style trigger: a single pg_cron job (or `/api/public/court-tick` called every minute by Supabase scheduler) calls `lockCase` for any case whose `verdict_lock_at <= now()` and `final_verdict is null`.

## Phase 3 — Court UI alignment

- `CourtroomPanel` shows current tier, category badge, countdown to `verdict_lock_at`, perspectives tab (already exists), Bench verdict line when locked.
- New `WatchParty.tsx` overlay surfaces when `verdict_lock_at - now < 60min`: live verdict bar via Supabase realtime, Bench commentary cards (fetched every 3–5 min from `bench_commentary` agent — added to AGENT_PROMPTS), countdown.
- `CourtTabs` filters by category (Romance/Family/Work/Friendship/Service/Stranger/Digital) + tier — derived from `court_cases`, not new endpoints.
- `CourtCaseCard` shows tier ribbon + category chip + `both_sides_heard` badge (reuses Phase-just-shipped flag).

## Phase 4 — Predictions + outcomes + reminders

- `predictions.functions.ts`: `submitPrediction`, `listPredictions`.
- Outcome submission UI on plaintiff’s closed cases — short overlay drawing options from `posts.prediction_options`. Writes `story_outcomes`, flips `posts.status='closed'`, evaluates `prediction_results`, fires Wisdom Graph writer.
- `outcome-reminders` cron (daily): pushes Bench reminders to plaintiff + verified named parties at 30/90/180/365 day milestones.

## Phase 5 — Wisdom Graph + reputation

- `wisdom_graph_writer` agent (already prompted earlier) wired to outcome submission only — writes nodes/edges via service role; never returned to client.
- `reputation.functions.ts` extended: on `court/lock` and on `outcome/submit`, recalc `justice_score`, `wisdom_score`, `prediction_score`, `juror_title` per spec; push when title changes.

## Out of scope for this plan

- Multi-language Bench voice variants (English copy only).
- Admin tooling for `city_courts.active` toggling (manual SQL for now).
- AEO sitemap priority bumps and per-case OG image generation (separate SEO pass).
- Re-vote / flip window UX when `both_sides_heard` flips true — DB allows it; UI prompt deferred.
- Mod queue for `candidacy_paused` cases (flag is set; review UI later).

## Technical notes (for engineers)

- Vote weight formula stays server-only inside `vote.functions.ts`; client never sees `weight`.
- `nomination_score` p95 is computed cheaply via `percentile_cont(0.95) within group (order by nomination_score) from posts where status='live' and not candidacy_paused`. Cached for 30s via `rate_limit_counters`-style key to avoid recompute storms.
- All AI calls go through existing orchestrator + `ai-broker`; no new edge functions, no new secrets.
- Realtime: Supabase realtime already enabled for `court_cases`; add `post_verdict_votes` for Watch Party.

## Build order summary

```text
Phase 1  migration ────────► review/approve
Phase 2  server fns + Bench prompt + cron ► smoke: post → vote burst → nomination → lock
Phase 3  UI: panel + watch party + tabs   ► visual review on /court
Phase 4  predictions + outcomes           ► plaintiff loop end-to-end
Phase 5  wisdom graph + reputation        ► leaderboard + graph rows visible
```

Confirm and I’ll start with the Phase 1 migration.