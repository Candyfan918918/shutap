## Translation notes

Your spec describes 13 Deno edge functions calling raw Anthropic. With your answers, I'm translating that into the TanStack equivalent. The behavior is preserved; only the substrate changes.

- **Edge functions → `createServerFn` modules** in `src/lib/*.functions.ts`. Client calls them via `useServerFn` (already wired). Webhooks/cron go to `src/routes/api/public/*`.
- **Anthropic → Lovable AI Gateway** via the existing `ai-sdk-lovable-gateway` helper. Default model `anthropic/claude-sonnet-4-5` (gateway-routed Claude — same family you asked for, no separate API key).
- **CORS headers** — not needed. Server functions are same-origin RPC.
- **`{ data, error }` return shape** — kept everywhere for client uniformity.
- **Age-gate** — centralized in a new `requireAgeVerified` middleware, not repeated per function.

## File map (existing vs new)

```text
EXTEND (already exist, don't duplicate):
  src/lib/spill.functions.ts        ← add question/answer/publish actions
  src/lib/scan.functions.ts         ← add question/answer/result actions
  src/lib/alias.functions.ts        ← add weighted-pool generator
  src/lib/court.functions.ts        ← add castVerdict with weighting + velocity check

NEW server-function modules:
  src/lib/ai-broker.functions.ts    ← single gateway broker, rate-limited, logged
  src/lib/orchestrator.server.ts    ← agent sequencer per moment (server-only helper)
  src/lib/moderation.functions.ts   ← flag/dispute/retract/appeal/resolve_claim
  src/lib/chatbot.functions.ts      ← chatbot with stream_override
  src/lib/hof.functions.ts          ← hall-of-fame scoring
  src/lib/reputation.functions.ts   ← 4-score recalc + juror_title
  src/lib/leads.functions.ts        ← lead broker with consent gate (extends existing)
  src/lib/auth-age-gate.functions.ts ← DOB → age check → set/refuse

NEW middleware:
  src/lib/middleware/require-age-verified.ts

NEW server-only helpers:
  src/lib/ai-gateway.server.ts      ← Lovable AI Gateway provider (per ai-sdk-lovable-gateway)
  src/lib/agent-prompts.server.ts   ← AGENT_PROMPTS map per moment
  src/lib/rate-limit.server.ts      ← DB-backed rate limiter

NEW route (cron):
  src/routes/api/public/hooks/outcome-tracker.ts   ← pg_cron daily, apikey-authed
```

## Schema migration (one PR, all GRANT + RLS)

Reusing existing tables where possible. New tables only where the spec genuinely needs them.

| Spec table | Decision |
| --- | --- |
| `verdicts` | **Reuse `post_verdict_votes`** + add columns: `weight numeric default 1.0`, `read_depth_percent int`, `ip_hash text`, `quarantined boolean default false`. |
| `aliases` | **Reuse `profiles`** + add columns: `nationality text`, `emotion text`, `creature text`, `juror_title text`. |
| `ai_call_log` | NEW. agent, user_id, story_id?, model, input_tokens, output_tokens, latency_ms, status. |
| `story_tags` | NEW. story_id, tag, confidence, source ('tagger'|'manual'). |
| `user_tags` | NEW. user_id, tag, confidence, last_seen_at. |
| `hof_scores` | NEW. entity_type, entity_id, score, period ('all'|'monthly'|'weekly'). |
| `hof_snapshots` | NEW. period_start, period_end, payload jsonb. |
| `claims` | **Reuse `post_approvals`** + add `claimer_id`, `status`. |
| `safety_log` | **Reuse `safety_events`** + add `action`, `resolved_at`. |
| `outcome_reminders` | NEW. story_id, milestone_day (30/90/180/365), sent_at. |
| `consent` | NEW. user_id, story_id, service_category, consented_at. (FK target for `leads`.) |
| `lead` | **Reuse `leads`** + FK to `consent`. |
| `rate_limit_counters` | NEW. user_id, bucket, window_start, count. |

Each new public table gets:
1. `CREATE TABLE`
2. `GRANT` (authenticated SELECT/INSERT/UPDATE; service_role ALL; no anon)
3. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
4. Policies scoped to `auth.uid()` (or service-role-only for `ai_call_log`, `hof_*`)

`age_verified boolean default false`, `dob_month int`, `dob_year int`, `account_created_at timestamptz default now()` added to `profiles` (account_created_at needed for "<7 days = 0.3x" vote weighting).

## Behavior preserved per function

| # | Spec name | Implementation |
| --- | --- | --- |
| 1 | `/ai-gateway` | `ai-broker.functions.ts::callAgent({ agent, context, story_id? })`. Uses `requireSupabaseAuth + requireAgeVerified`. Rate-limit (Spill 20/day, Scan 100/day) via `rate_limit_counters`. Logs to `ai_call_log`. Calls Lovable AI Gateway with `AGENT_PROMPTS[agent]`. |
| 2 | `/orchestrator` | `orchestrator.server.ts::runMoment(moment, payload, userId)`. Server-only — never directly called by the client; invoked by spill/scan/court/chatbot/hof functions. Routes the agent sequence per moment. |
| 3 | `/vote` | `court.functions.ts::castVerdict`. Weight = read-depth tier × age multiplier (<7d → 0.3x). Writes `post_verdict_votes`. Velocity check: 10+ same `ip_hash` in 5min → set `quarantined=true`. Realtime broadcast on the existing `court_cases` channel. Fires `hof_update` via orchestrator (no await). |
| 4 | `/auth-age-gate` | `auth-age-gate.functions.ts::verifyAge`. <18 → `supabaseAdmin.auth.admin.deleteUser(userId)` + return `{ error: "age_gate_failed" }` with 403. ≥18 → `profiles.age_verified=true`. No retry — DOB columns become read-only once `age_verified=true`. |
| 5 | `/alias-generate` | `alias.functions.ts::generateAlias`. Weighted pull from `alias_pool_*` tables (already exist). Weighting: emotion×(entry_category,time_of_day), creature×relationship_type. Uniqueness check against `profiles.handle` + retry ≤5. Returns shape; does NOT write. |
| 6 | `/spill` | `spill.functions.ts` — add `spillAction({ action, session_id, content?, story_draft? })`. `question` → orchestrator `spill`. `answer` → append + next prompt. `publish` → Guardian gate (`safety/risk-classifier`) → editor agent → write to `stories`. |
| 7 | `/scan` | `scan.functions.ts::scanAction({ action, session_id, content? })`. `question` → adaptive next via orchestrator `scan`. `result` → write `scan_results`, then orchestrator `tagger` + `lead_qualifier`. |
| 8 | `/lead-broker` | `leads.functions.ts::brokerLead({ story_id, service_category, consent_given })`. Reads `story_tags` + `user_tags`. If `crisis_signal` tag present → return crisis resources only, no lead row. Else: insert `consent` first, then `leads` with FK. |
| 9 | `/moderation` | `moderation.functions.ts::moderate({ story_id, action, reason?, claimer_id? })`. Switches over flag/dispute/retract/appeal/resolve_claim. Writes `safety_events` + `post_approvals`. Updates `stories.status`. |
| 10 | `/chatbot` | `chatbot.functions.ts::chat({ message })`. Reads `user_tags`. Calls orchestrator `chatbot`. The chatbot agent emits a SQL-shaped query payload; executor runs it through `supabaseAdmin` with column allowlist (no raw SQL — structured filter spec only). Returns `{ response_text, stream_override }`. |
| 11 | `/hof-engine` | `hof.functions.ts::recordEvent({ event_type, entity_type, entity_id, metrics })`. Orchestrator `hof_update` → write `hof_scores`. Period-boundary detection → snapshot to `hof_snapshots`. |
| 12 | `/outcome-tracker` | `src/routes/api/public/hooks/outcome-tracker.ts` (cron-only). Verifies `apikey` header against `SUPABASE_PUBLISHABLE_KEY`. Queries decided court cases at 30/90/180/365 day marks. Writes `outcome_reminders`, inserts `notifications`. Scheduled via `pg_cron` + `pg_net`. |
| 13 | `/reputation-engine` | `reputation.functions.ts::recalc({ event_type, event_data })`. Computes 4 scores (jury accuracy, story quality, engagement, longevity), updates `profiles.juror_title` if threshold crossed. |

## Shared building blocks

```ts
// src/lib/middleware/require-age-verified.ts
export const requireAgeVerified = createMiddleware({ type: 'function' })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data } = await context.supabase
      .from('profiles').select('age_verified').eq('id', context.userId).single();
    if (!data?.age_verified) throw new Error('age_gate_required');
    return next();
  });
```

```ts
// src/lib/ai-gateway.server.ts — copies the canonical helper verbatim
//   (per ai-sdk-lovable-gateway knowledge; X-Lovable-AIG-SDK header etc.)
```

```ts
// Uniform return shape on every server fn:
type ServerResult<T> = { data: T | null; error: string | null };
```

## Ordering (matters — `supabase--migration` is async)

1. **Migration call** (single SQL block, all GRANTs + RLS + policies). Wait for approval.
2. After approval lands and types regen: write all server-function modules + middleware + ai-gateway helper + cron route.
3. Verify with `invoke-server-function` against `ai-broker` and `auth-age-gate`.
4. Wire `pg_cron` to call the outcome-tracker route daily.

## Out of scope (call out, don't silently build)

- No client UI changes. Every existing screen keeps working; new functions are dormant until something invokes them.
- No edge functions get created — `supabase/functions/` stays untouched.
- No raw Anthropic key. If you later need direct Anthropic for SLA/compliance reasons, that's a separate decision.
- `outcome-tracker` only schedules the cron route file; activating `pg_cron` against your stable URL is a one-line SQL the user approves after the route is live.
- Bench-voice copy for the chatbot's `response_text` is not authored here — chatbot agent prompt enforces tone; humans write nothing AI-generated per your AI-native rule.
