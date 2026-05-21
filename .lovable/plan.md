# Code Debt Cleanup Plan

Moderate scope. No behavior changes — only renames, copy fixes, dead-code removal, and one targeted module consolidation. Each pass is independently verifiable.

## 1. Branding & copy sweep (Marriage Drama → Shutap)

Stale strings still leaking the old brand:

- `src/routes/__root.tsx` — meta description / og:description / twitter:description still say "marriage and divorce stories".
- `src/routes/index.tsx` line 22 — hero meta description still uses old framing.
- `src/components/post-engine/ScoreCard.tsx` — footer reads `marriagedrama.app`.
- `src/routes/post.$postId.tsx` — fallback origin URL `https://marriagedrama.app`.
- `src/lib/i18n/messages.ts` — `wall.sub`, `wall.loadMore`, EN/ZH/ES/PT subtitles, "drama Olympics", "marriages somehow survived", "drama scanner" CTAs, "Your marriage story is ready to go viral".
- `src/lib/posts.functions.ts` line 61 + 78 — AI system prompt still says "marriage story posts" and example title references marriages.
- `src/routes/_authenticated/spill/$draftId/score.tsx` line 78 — "🌎 Drama Olympics".
- `src/components/drama/ScoreReveal.tsx` line 97 — "marriages we've scanned".

All replaced with Shutap-aligned wording (relationship stories, Chaos Score™, "Relationship Scan", etc). DB enum values (`reaction_kind.drama`) and translation keys stay as-is — those are stable identifiers.

## 2. Rename legacy `drama/` folder → `scan/`

`src/components/drama/` is still actively imported but misnamed after the rebrand.

- `src/components/drama/DramaQuestion.tsx` → `src/components/scan/ScanQuestion.tsx` (exported as `ScanQuestion`)
- `src/components/drama/ScanProgress.tsx` → `src/components/scan/ScanProgress.tsx`
- `src/components/drama/ScoreReveal.tsx` → `src/components/scan/ScoreReveal.tsx`
- Delete the empty `src/components/drama/` folder.
- Update the 3 importers: `scan/question.$step.tsx`, `scan/result.$scanId.tsx`, `spill/$draftId/score.tsx`.

Pure rename; logic untouched.

## 3. Consolidate posts function modules

Today there are three overlapping files; their boundaries are blurry:

- `posts.functions.ts` (278 lines) — draft generation, create/update/approve, share recording, reactions.
- `posts-manage.functions.ts` (252 lines) — author CRUD, public listings, chaos history, forwards.
- `posts-public.functions.ts` (43 lines) — `getPublishedPost`, `getPostReactionCounts`.

Reorganize into a clearer split:

- `src/lib/posts/drafts.functions.ts` — `generateStoryDraft`, `createDraftPost`, `updateDraftPost`, `approveAndPublish` (authoring pipeline).
- `src/lib/posts/manage.functions.ts` — author dashboard: `listMyPosts`, `getMyPostCounts`, `setPostVisibility`, `publishPost`, `unpublishPost`, `softDeletePost`, `editPost`.
- `src/lib/posts/public.functions.ts` — anonymous reads: `getPublishedPost`, `getPostReactionCounts`, `listAuthorPublicPosts`, `getChaosHistory` (move the last two out of `posts-manage`, since they serve public profile pages).
- `src/lib/posts/engagement.functions.ts` — `recordShare`, `reactToPost`, `recordForward`.

Old files deleted; all importers updated. Shared types (`MyPostRow`, `PublicPostRow`, `ChaosHistoryRow`) live next to their primary owner and are re-exported where needed.

## 4. Dead code & unused-export sweep

- Run `rg`-based scan for: unused exports, orphan files, unreferenced i18n keys, no-op `console.log` calls.
- Confirmed dead so far: nothing major beyond the renames above. Will verify after passes 1–3 land.
- Light pass: remove any leftover commented-out blocks AI added during earlier iterations.

## Verification

- TypeScript build must pass (automatic on each save).
- Spot-check four flows in preview: landing page, Relationship Scan, Spill the Tea draft → score, profile post list.
- Grep confirms zero remaining matches for `marriage drama`, `marriagedrama.app`, `drama scanner`, `Drama Olympics`.

## Out of scope

- DB schema, enum values, migrations.
- Spill the Tea adaptive logic, scan engine, share-card renderer — all working as intended.
- New features.
