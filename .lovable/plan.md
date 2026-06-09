# Multi-Party Response Flow ("Are you someone in this story?")

Lets readers self-identify as named parties, participants, or witnesses to a published story, verify their standing, and add their own perspective. Each verified perspective gets its own engagement (relate, comments, verdict sub-thread), feeds into Court, and lands in the Wisdom Graph.

## User-visible behavior

- Every published post shows a Bench-voice prompt to readers: "Are you someone in this story?"
- Tapping it opens a 3-step flow:
  1. Role select — Named party / Participant / Witness
  2. Standing verification — short structured prompts (claimed name/role, 2-3 corroborating facts only someone present would know, optional receipts upload) judged by the `standing_judge` agent
  3. On pass → routed into the right response surface:
     - Named party → full Spill co-pilot, marks the case `both_sides_heard = true`
     - Participant → shorter "partial response" Spill, marks `additional_perspectives = true`
     - Witness → short statement form, shows under "Other Perspectives"
     - Fail → toast in Bench voice, user becomes a regular commenter
- Original post page gets a new "Other Perspectives" section listing each verified response with its own relate count, comments, and verdict sub-thread.
- Court: if the case is in court, jurors see all perspectives side-by-side; the verdict timer locks all perspectives simultaneously when it closes.
- Outcome reminders fire to the plaintiff and every verified named party.
- Wisdom Graph node for the resolved case records: number of sides, cross-side verdict consistency, outcome type.

## Voice

All system copy in The Bench voice. Sample strings:
- Prompt: "If you were there, the court will hear you."
- Verify success: "Standing granted. Speak."
- Verify fail: "The court is not convinced. You may still watch."
- Lock: "Submissions closed. The verdict stands across all parties."

No emojis in Bench lines, no exclamation marks.

## Data model (new tables / columns)

```text
posts
+ both_sides_heard         boolean  default false
+ additional_perspectives  boolean  default false
+ perspective_count        integer  default 0

post_perspectives                         -- one row per verified response
  id uuid pk
  post_id uuid fk posts on delete cascade
  responder_id uuid fk auth.users
  role text check in ('named_party','participant','witness')
  standing_status text check in ('pending','verified','failed')
  standing_score int                       -- 0-100 from judge
  standing_notes text                      -- judge reasoning (private)
  response_text text                       -- the response Spill
  receipts_urls text[] default '{}'
  relate_count int default 0
  comment_count int default 0
  locked_at timestamptz                    -- set when court closes
  created_at, updated_at

post_perspective_relates                  -- per-perspective relate taps
  perspective_id uuid fk, user_id uuid fk, primary key
post_perspective_comments                 -- sub-thread comments
  id, perspective_id fk, author_id, body, created_at, deleted_at
post_perspective_verdicts                 -- jury sub-thread verdicts
  perspective_id, user_id, kind, weight, created_at, primary key (perspective_id, user_id)

standing_verifications                    -- audit trail; private
  id, perspective_id fk, attempt_no int, claimed_facts jsonb,
  agent_output jsonb, decision text, created_at
```

RLS:
- `post_perspectives` SELECT public when `standing_status='verified'`; INSERT auth; UPDATE only own row while `standing_status='pending'`.
- relates/comments/verdicts: same shape as existing `post_*` analogues.
- `standing_verifications`: SELECT own + admin; INSERT auth; never returned to non-owners.
- All new public tables get GRANTs for `authenticated` (+ `anon` SELECT only on `post_perspectives` verified rows) and `service_role`.

## Server functions (TanStack `createServerFn`)

`src/lib/perspectives.functions.ts`
- `startPerspective({post_id, role})` → creates pending row, returns id
- `submitStandingFacts({perspective_id, claimed_facts, receipts_urls})` → runs orchestrator moment `standing_verify` (new), updates row, returns `{verified|failed}` only
- `submitPerspectiveResponse({perspective_id, response_text})` → only when verified; flips `posts.both_sides_heard / additional_perspectives / perspective_count`
- `listPerspectives({post_id})` → public, verified only, strips `standing_notes`
- `relatePerspective`, `commentPerspective`, `castPerspectiveVerdict` — mirrors of existing post equivalents
- `lockPerspectivesForCase({case_id})` — called by court cron when `closes_at` hits; sets `locked_at` on all rows for that post

## Agent additions (`src/lib/agent-prompts.server.ts`)

New private agent `standing_judge` (added to `PRIVATE_AGENTS`):
- Input: `{post_excerpt, role, claimed_facts, receipts_present:boolean}`
- Output: `{verified:boolean, score:0-100, reasoning:string, missing_signals:string[]}`
- Never returned to client; only `verified` boolean surfaces.

New orchestrator moment `standing_verify` → `[standing_judge, privacy_shield]` (shield scrubs claimed facts before storage).

Wisdom Graph: extend `wisdom_graph_writer` payload to include `perspective_count`, `verdict_consistency` (0-1 across sub-threads), `sides_heard`. No prompt change required beyond adding fields to the moment payload.

## Court integration

- `CourtroomPanel`: when a case has `perspective_count > 0`, render a tabbed strip of perspectives (Plaintiff + each verified responder by alias). Each tab shows its own verdict bar + comment thread.
- Cron (`/api/public/hooks/court-tick`): on close, call `lockPerspectivesForCase` then the existing `finalize_court_cases()` SQL fn.
- Outcome reminder fanout: extend the existing notification block in `finalize_court_cases` to also insert one notification per verified named-party responder.

## UI surfaces (new components)

- `src/components/perspectives/ResponderEntry.tsx` — the "Are you someone in this story?" prompt on every post.
- `src/components/perspectives/RoleSelectSheet.tsx`
- `src/components/perspectives/StandingVerify.tsx` — wraps the existing Spill `ChatBubble` for the claimed-facts Q&A.
- `src/components/perspectives/PerspectiveCard.tsx` — alias header, response excerpt, relate/comment/verdict bar.
- `src/components/perspectives/OtherPerspectives.tsx` — list on post page + Court tab strip.

All entry CTAs route through the existing `useGateStore.enqueue(...)` so signed-out readers go through `IdentityCeremony`.

## Migrations

Two migrations:
1. Add columns + new tables + GRANTs + RLS + policies + indexes
2. Extend `finalize_court_cases()` to fan out notifications & lock perspectives

## Out of scope (this plan)

- No changes to spill_copilot prompt — it already handles short vs full flows by exchange count.
- No new chatbot intents for perspectives (can come later).
- No moderator UI for reviewing failed standing attempts (admin SQL only for now).

## Build order

1. Migration 1 (schema + RLS + GRANTs)
2. Agent prompt + orchestrator moment
3. Server functions
4. UI: ResponderEntry → RoleSelect → StandingVerify → PerspectiveCard → OtherPerspectives
5. Wire into `PostPage` and `CourtroomPanel`
6. Migration 2 (court close fanout + lock)
7. Smoke test: publish → respond as named party → verify → submit → see in Other Perspectives → vote → close court → outcome reminder
