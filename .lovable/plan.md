# Marriage Drama Scan™ — Full Build Plan

Build the complete quiz → score → reveal → draft post → share flow as the app's P0 product feature. Everything below ships in one implementation pass.

## 1. Database (one migration)

New table `scan_results` (RLS on):
- `id`, `user_id`, `locale`, `status` (`in_progress` | `completed`)
- `current_step` (int), `answers` (jsonb), `flow_path` (jsonb — ordered question ids actually shown)
- `score` (int 0–1000), `subscores` (jsonb), `category` (text), `percentile` (int), `tags` (text[]), `badges` (text[])
- `post_id` (uuid, nullable — link to generated post)
- `created_at`, `updated_at`, `completed_at`

RLS:
- owner full CRUD on own rows
- completed rows readable by anyone with the id (for share links) — `status = 'completed'` OR `auth.uid() = user_id`

Index on `(user_id, created_at desc)` for history.

## 2. Question Bank (`src/lib/scan/question-bank.ts`)

~26 questions across 7 categories: `foundation`, `plot_twists`, `emotional`, `communication`, `financial`, `family`, `love_bonus`.

Each question:
```
{ id, category, type, weight, scoreMap, localized: { en, zh, ja, ko, es, pt } { title, subtitle?, helper?, options[]{ id, label, value, score? } }, conditional? }
```

Types: `single`, `multi`, `slider`, `emoji_scale`, `cards`, `text` (text not scored — used for free-text "plot twist" capture).

Conditional rules use a tiny predicate DSL:
```
conditional: { showIf: { all: [{ q: "has_kids", eq: "yes" }] } }
```

Each question contributes to ONE subscore via `scoreMap` (option → points) or `weight × normalized slider value`.

## 3. Question Engine (`src/lib/scan/question-engine.ts`)

Pure functions:
- `getInitialFlow(locale)` → ordered base ids
- `nextQuestion(answers, flowPath)` → next id or `null`
- `evaluateConditional(rule, answers)` → boolean
- `injectFollowUps(answers)` → dynamically append plot-twist follow-ups and healing questions if emotional damage > threshold
- `progress(flowPath, currentIdx)` → `{ step, total, percent, etaSeconds }`

## 4. Scoring Engine (`src/lib/scan/drama-score.ts`)

`calculateDramaScore(answers)` → `{ totalScore, subscores, category, percentile, tags, badges }`

Subscore caps: Plot Twist 200, Emotional 200, Financial 150, Family 150, Communication 150, Love Bonus -200…0.
Total = clamp(sum, 0, 1000).
Category bands per spec (Disney → Legendary Chaos).
Tags: derived from which questions hit (e.g. `cheating`, `in-laws`, `silent-treatment`).
Badges: ≥3 derived from subscore peaks ("Plot Twist Royalty", "Wallet Needs Therapy", "Still Romantic Somehow").
Percentile: simple deterministic curve over total (placeholder — real percentile later from DB aggregate).

## 5. Server functions (`src/lib/scan.functions.ts`, auth-protected)

- `startScan({ locale })` → creates `in_progress` row, returns `{ scanId, firstQuestionId, flowPath }`
- `saveAnswer({ scanId, questionId, answer })` → upserts into `answers`, recomputes `flow_path`, returns `nextQuestionId | null` + `progress`
- `completeScan({ scanId })` → runs `calculateDramaScore`, persists score/subscores/category/tags/badges, sets `completed_at`, returns full result payload
- `getScan({ scanId })` → returns scan (owner or completed)
- `listMyScans()` → history
- `generatePostDraft({ scanId })` → calls Lovable AI Gateway (`google/gemini-2.5-flash`) with score context to produce `{ title, story, badges, hashtags, platform_captions }`; returns draft (does NOT publish)
- `publishScanPost({ scanId, draft, mediaUrl })` → inserts `posts` row (status=`published`), links `scan_results.post_id`

Wire `attachSupabaseAuth` already present in `src/start.ts` — verify.

## 6. Routes (`src/routes/scan/*`)

All gated under `_authenticated`. Move to `src/routes/_authenticated/scan/`:
- `index.tsx` — Splash + "Start Drama Scan" CTA. Explains 3-min, fun copy.
- `start.tsx` — Calls `startScan`, redirects to first question.
- `question.$step.tsx` — Renders one `<DramaQuestion>` for the current step. Reads scan from server, hydrates `answers`, calls `saveAnswer` on submit, navigates to next step or `/scan/result/$scanId`. Supports back nav (undo).
- `result.$scanId.tsx` — Cinematic reveal: animated number count-up, category, subscore bars, badges, funny commentary. CTAs: "Turn this into a post" → draft, "Share my score" → share screen, "See my history".
- `share.$scanId.tsx` — Compose preview: AI draft (editable title/story), required media uploader, "Publish" → calls `publishScanPost`, then opens share popup using existing `native-share` + share-card endpoint.

Homepage button (`src/routes/index.tsx`) gets `<Link to="/scan">`.

History: `src/routes/_authenticated/profile/scans.tsx`.

Locale prefix routing already handled by existing i18n setup — no per-locale duplicate route files needed (locale is part of context, not URL segment in current architecture).

## 7. Components (`src/components/drama/`)

- `DramaQuestion.tsx` — switches on `question.type`, renders the right input (cards, slider, emoji row, multi-chip, text). Big touch targets, swipe + tap, framer-motion enter/exit (visible-by-default initial state to avoid the SSR-hidden bug from earlier).
- `ScanProgress.tsx` — sticky top bar with `████░░`, "Question X / Y", rotating status messages from a localized pool ("Scanning for plot twists…").
- `OptionCard.tsx`, `EmojiScale.tsx`, `DramaSlider.tsx`, `CardPicker.tsx` — primitives.
- `ScoreReveal.tsx` — count-up animation, gradient backdrop tied to tier, subscore bar chart, badge chips, commentary lines.
- `DraftEditor.tsx` — title/story editing + media upload (reuses storage bucket `story-media`).

## 8. State / persistence

Server-truth + optimistic local cache via React Query:
- `useScanQuery(scanId)` — `getScan`
- `useSaveAnswer()` — mutation that optimistically updates answers, on success navigates to next step
- Autosave per step (each `saveAnswer` is the save)
- Resume = navigating to `/scan/question/{current_step}` of latest `in_progress` row (homepage CTA checks for existing in-progress scan and offers resume).

## 9. Post + Share integration

After `completeScan`, reveal screen shows "Turn into a post" → `share.$scanId`:
1. Calls `generatePostDraft` (AI) → fills editor.
2. User edits + uploads required image/video.
3. `publishScanPost` writes to `posts`, links scan, redirects to `/post/{postId}`.
4. Existing native-share + `/api/public/share-card/{postId}` pipeline handles share.

## 10. i18n

Add `scan.*` keys to `src/lib/i18n/messages.ts` for: CTAs, progress labels, status rotations, category labels, commentary templates, reveal copy, share copy — for `en` and `zh` minimum (other locales fall back to en).

Question bank ships `en` + `zh` fully; `ja/ko/es/pt` fall back to `en` (extendable later).

## 11. Technical notes

```text
src/
├─ lib/scan/
│  ├─ question-bank.ts        // localized question definitions
│  ├─ question-engine.ts      // flow + conditional + progress
│  ├─ drama-score.ts          // scoring + categories + badges + tags
│  ├─ conditional-routing.ts  // predicate DSL evaluator
│  └─ post-generator.ts       // prompt builder for AI draft
├─ lib/scan.functions.ts      // all server fns (createServerFn + requireSupabaseAuth)
├─ components/drama/
│  ├─ DramaQuestion.tsx
│  ├─ ScanProgress.tsx
│  ├─ ScoreReveal.tsx
│  ├─ DraftEditor.tsx
│  └─ inputs/{OptionCard,EmojiScale,DramaSlider,CardPicker}.tsx
└─ routes/_authenticated/scan/
   ├─ index.tsx
   ├─ start.tsx
   ├─ question.$step.tsx
   ├─ result.$scanId.tsx
   └─ share.$scanId.tsx
+ routes/_authenticated/profile/scans.tsx
+ migration: scan_results table + RLS
```

AI: `google/gemini-2.5-flash` via existing `src/lib/ai/gateway.ts`.
SSR safety: all framer-motion in question/reveal uses `initial={false}` or visible-by-default; protected server-fn loaders only under `_authenticated` (prerender-safe).

## 12. Out of scope (called out)

- Real percentile from DB aggregates (uses deterministic curve for now; can be replaced by a nightly job later).
- Localized question text beyond `en` + `zh` (others fall back).
- A/B variations of question copy.

Once you approve, I'll implement everything above in one pass: migration → libs → server fns → components → routes → homepage wiring.
