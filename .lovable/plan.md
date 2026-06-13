## Diagnosis

The seed data is present and healthy:
- 993 published+public seed posts
- 199 court_cases, 70 `in_court`
- 27,676 comments on 834 seeded posts
- 61,688 verdict votes

The `/stream` feed is actually working — the session replay shows cards 1–126 rendering as you scroll. If "stream looks empty" to you, it's almost certainly because you're on `/` (marketing landing), which by design only renders **3 live cases + 6 stories**, not the full feed. The full stream is at `/stream`.

The real bug is `/court`. It queries `court_cases` by `(scope, region_code)` exact match, and your seed put cases in the wrong buckets:

| Bucket | Cases | Will `/court` show them? |
|---|---|---|
| `scope=world, region_code=WORLD`, status=`in_court` | **0** | World tab shows 0 live cases |
| `scope=world, region_code=WORLD`, status=`decided/legendary` | 10 | Shows in "decided" group only |
| `scope=country, region_code=XX` (placeholder, not a real ISO) | 71 (23 in_court + 48 decided) | Never matches a real viewer country |
| `scope=country, region_code=US/GB/CA/IN/JP/AU` | 7 each, all `decided` | Country tab shows decided only, no live |
| `scope=city, region_code=city_<hash>` | ~30 | Matches no real viewer city |

Net effect: the World tab shows ~10 decided cases and nothing "Live"; the Country tab (auto-selected when the viewer has a country) shows 7 decided cases and zero in_court. The page reads as empty / dead.

## Fix

Rebalance existing seed court_cases into real, viewer-reachable buckets so `/court` lights up immediately. No code changes — this is a one-shot data migration on seeded rows only.

1. **Move `region_code='XX'` country cases onto real ISO codes**
   Spread the 71 placeholder rows evenly across `US, GB, CA, IN, JP, AU, DE, FR, BR, NG` so each country tab has a mix of `in_court` + `decided`.

2. **Promote a healthy slice into `WORLD` / `in_court`**
   Re-bucket ~15 of the highest-engagement seeded `country/in_court` cases to `scope='world', region_code='WORLD', status='in_court'`, and set their `region_label='World Court'`, `current_tier='world'`, and `closes_at = now() + interval '24 hours'` so the countdown chip is alive.

3. **Give city cases real cities**
   Rewrite `region_code='city_<hash>'` rows to the city of the post's author (`profiles.city`), normalized (`lower(replace(city,' ','_'))`), and set `region_label = initcap(city) || ' City Court'`. Drop rows whose author has no city.

4. **Sanity backfill on the affected rows only**
   For every touched row: ensure `closes_at`/`verdict_lock_at` are in the future when `status='in_court'`, and that `engagement_score >= 1` so the sort order surfaces them.

5. **Verify**
   After the migration, re-run:
   - `WORLD/in_court` count ≥ 10
   - Each of US/GB/CA/IN/JP/AU has ≥ 3 `in_court`
   - `/court` World tab and Country tab both render live + decided rows

## Out of scope

- No changes to `composeStream`, `/stream`, or the marketing landing.
- No new seed runs; only re-buckets what's already there.
- No schema changes, no RLS changes, no app code changes.

## What you should also know (separate from the fix)

- The landing page (`/`) intentionally shows only a teaser. To see the full seeded feed, open `/stream`.
- Comments are attached to posts (834 seeded posts have comments). They show on `/post/$postId`, not on stream cards. If a specific seeded post has no comments visible, share its URL and I'll trace that one.
