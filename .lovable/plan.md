# Refactor: Daily Court → 👑 Relationship Court™

Turn the static daily case into a **live, regional, event-based** community system with countdowns, honor badges, and shareable milestones.

## Scope

Rename + restructure the existing `/court` route, add region scoping, multi-case selection, countdowns, lifecycle statuses, author notifications, honor-board badges on profiles, and milestone share cards.

## 1. Data model (migration)

Replace single-row-per-day `daily_cases` with a richer `court_cases` table that supports multiple concurrent cases across regions and tracks lifecycle.

```text
court_cases
  id, post_id, scope ('city' | 'country' | 'world'),
  region_code (e.g. 'US', 'JP', 'US-CA-SF', 'WORLD'),
  region_label, status ('nominated' | 'in_court' | 'judgment_pending' | 'decided' | 'legendary'),
  nominated_at, opens_at, closes_at, decided_at,
  final_verdict (text), ai_summary (text),
  controversy_score, engagement_score, created_at, updated_at

court_case_badges  (honor board entries)
  id, post_id, author_id, case_id, badge_kind
  ('court_featured' | 'world_court' | 'viral_case' | 'public_debate' |
   'final_verdict_run' | 'final_verdict_red_flag' | ...),
  region_label, earned_at, pinned (bool)

court_notifications  (uses existing notifications table; new `kind`s:
  'court_nominated', 'court_entered', 'court_trending',
  'court_world', 'court_countdown', 'court_verdict')
```

Keep `daily_cases` table around (read-only) for backwards compatibility; new code reads from `court_cases`.

RLS: `court_cases` and `court_case_badges` are publicly readable; writes only via SECURITY DEFINER functions called from server fns.

DB functions:
- `nominate_court_cases(_scope, _region, _now)` — picks top trending posts in a region using `comments*3 + likes*2 + shares*2 + saves + views/10 + controversy_bonus` and inserts as `nominated`. Idempotent.
- `promote_court_cases(_now)` — moves `nominated` → `in_court` after threshold, sets `closes_at = now + 24h`.
- `finalize_court_cases(_now)` — for any `in_court` past `closes_at`: tallies `post_verdict_votes`, sets `final_verdict`, generates ai_summary template, status → `decided`, awards badges, inserts notifications. Marks top global cases `legendary`.

## 2. Region detection

- Server fn `getViewerRegion()` reads `request-cf-ipcountry` / `x-vercel-ip-country` headers (workerd exposes `cf-ipcountry`); fallback to `WORLD`.
- City scope only when the post's `posts` row has `city`/`country` (already on profiles, propagate from author at publish time — small server-fn helper).
- User can switch tab: Near You / Country / Worldwide.

## 3. Server functions (`src/lib/court.functions.ts` — rewrite)

- `getViewerRegion()` → `{ country, city, label }`
- `listCourtCases({ scope, region, status? })` → cases + post snippets + vote tallies + time-left
- `getCourtCase({ caseId })` → full case + post + verdict counts + hot comments + countdown
- `castCourtVerdict({ caseId, kind })` → wraps existing `castVerdict`, also records `recordParticipation` for streaks
- `getAuthorCourtStatus()` → cases where viewer is author, with status + countdown + share assets
- `getHonorBoard({ userId })` → badges for a profile (pinned first)
- `togglePinBadge({ badgeId })` → author-only

Public scheduling endpoint (NEW): `src/routes/api/public/hooks/court-tick.ts`
- POST with `apikey` header (anon key)
- Calls `nominate_court_cases` for each active region + `WORLD`, then `promote_court_cases` + `finalize_court_cases`.
- Scheduled via `pg_cron` every 15 minutes.

## 4. UI

Rename route `/court` → keep the URL (no breaking links), update branding to **👑 Relationship Court™ — Where the internet decides.**

New layout:
```text
/court
├── Header: 👑 Relationship Court™ + tagline + streak chip
├── Tabs: [Near You] [Country] [Worldwide]
├── Featured "In Court" case (large card + countdown + verdict bar)
├── Section: ⏳ Judgment Pending (grid)
├── Section: 👀 Nominated (smaller cards)
└── Section: 👑 Final Decisions (recent decided cases w/ verdicts)
```

New components:
- `src/components/court/CountdownChip.tsx` — live `mm:ss` / `Xh Ym` ticker
- `src/components/court/CourtCaseCard.tsx` — cover, headline, region flag, status pill, countdown, verdict mini-bar
- `src/components/court/CourtTabs.tsx` — scope switcher
- `src/components/court/HonorBadge.tsx` — trophy chip used in profile + author status
- `src/components/court/MilestoneShareCard.tsx` — generates a sharable canvas/og card for each milestone
- `src/components/court/AuthorCourtStatus.tsx` — on `/me`, shows author's active cases

Feed integration:
- `FeedCard` shows a **⚖️ In Court — Judgment in 7h 12m** ribbon when the post has an active `court_cases` row.
- Post page (`post.$postId`) shows the same ribbon + a "View in Court" link.

Profile integration (`/u/$handle` and `/me`):
- Honor Board strip showing earned badges (pinned first). Author can pin/unpin from `/me`.

## 5. Author notifications

When `nominate_court_cases` / `promote_court_cases` / `finalize_court_cases` runs, insert rows into existing `notifications` table with new `kind`s. UI: small bell badge in `PrimaryNav` (count of unread). Clicking opens a dropdown with the prestigious copy:
- "👀 Your story entered {region} Court."
- "🔥 Your story entered US Court."
- "🌎 Your story entered World Court."
- "👑 Final verdict is in."

## 6. Final verdict + AI summary

When finalizing, compute the winning verdict kind from `post_verdict_votes`. Generate `ai_summary` by template (no AI call needed for v1):
- "🏃 Final Verdict: RUN. 78% of the internet agrees. The jury has concerns 😭"
- "🗣 Final Verdict: Talk It Out. This one deserves one honest conversation."

(AI Gateway call optional later — keep deterministic for v1.)

## 7. Share cards

For each milestone (nominated, entered, trending, countdown, verdict), generate an OG image URL via a new server route `/api/public/court/og/$caseId.png` returning a rendered SVG → PNG (use `@resvg/resvg-wasm` if compatible; otherwise serve SVG directly and let platforms convert). The post page adds dynamic `head()` `og:image` referencing this URL.

## 8. Cron schedule

Insert (via insert tool, not migration) one pg_cron job:
```sql
select cron.schedule(
  'court-tick',
  '*/15 * * * *',
  $$ select net.http_post(
    url := 'https://project--29d52b59-0fed-4a8a-a2b3-eab0b9ac8c47.lovable.app/api/public/hooks/court-tick',
    headers := '{"Content-Type":"application/json","apikey":"<ANON>"}'::jsonb,
    body := '{}'::jsonb
  ) $$
);
```

## 9. Migration steps (ordered)

1. **Migration**: create `court_cases`, `court_case_badges`, RLS, DB functions (`nominate_*`, `promote_*`, `finalize_*`), enable pg_cron + pg_net.
2. **Insert** (post-approval): seed initial `WORLD` nominations from existing high-engagement posts so the page isn't empty.
3. **Insert**: pg_cron schedule for `court-tick`.
4. **Server fns**: rewrite `src/lib/court.functions.ts`.
5. **Server route**: `src/routes/api/public/hooks/court-tick.ts` (anon key gated).
6. **UI**: new components + rewrite `src/routes/court.tsx`.
7. **Feed/Post integration**: ribbon on `FeedCard` + `post.$postId`.
8. **Profile**: Honor Board on `/u/$handle` and `/me` with pin controls.
9. **Notifications**: bell in `PrimaryNav` + dropdown.
10. **Share cards**: OG route + wire into post `head()`.

## Out of scope (v1)

- Real LLM-generated verdict summaries (templated for now)
- Push/email notifications (in-app only)
- City-level resolution beyond what's on `posts` (no geocoding)
- Per-region tournaments / brackets (status framework leaves room for v2)

## Risks / notes

- `cf-ipcountry` header may be absent on preview; fall back to `WORLD` cleanly.
- Existing `/court` callers (homepage nav, daily streak) keep working — `recordParticipation` is preserved and called from `castCourtVerdict`.
- Bell/notifications UI is new but reuses existing `notifications` table — no schema change beyond accepted `kind` values (free text).

Want me to proceed with this plan, or trim/expand any section (e.g. skip OG cards in v1, skip notifications bell, drop city scope)?
