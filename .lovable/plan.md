# Rebuild the 5 pillars to match the attached HTML mockups

## Scope

The 5 attached HTML files are full design references with hand-tuned CSS, hero banners, animated bars, dynamic input cards, score reveals, timelines, etc. Total reference: ~3,200 lines of pure styling + markup across the 5 files.

The rebuild will preserve every existing route's data wiring (loaders, server functions, mutations). Only the presentation layer is replaced. No backend changes.

## Pass 1 — Unified design tokens (one file)

Edit `src/styles.css` to align with the mockups' shared root:

- Add missing palette deeps: `--c-coral-soft/border/ink` already exist; add `--c-gold-soft/border/deep` (HOF only uses this — `#fef9ec / #f5d97a / #5a3d00`).
- Add ink scale used in heroes: `--c-ink: #0a080f`, `--c-ink-2: #3a3040`, `--c-ink-3: #7a6880` — used by every dark hero in Scan / Spill / HOF.
- Add shared utility classes used across multiple pillars: `.hero-dark` (black hero with two coloured orb blobs), `.section-eyebrow`, `.live-pill`, `.cat-pill--*` (already partial — extend to all five categories with consistent border/ink), and `.vbar` segments.
- Map Tailwind utilities for the new tokens so route files can use `bg-c-ink`, `text-c-ink-3`, `bg-c-gold-soft`, etc.

## Pass 2 — Rebuild each pillar (one route file each)

For every pillar I will rebuild the primary screen (Screen 1 of each mockup, which is the canonical view). Variant screens shown in the mockups (timeline builder, score reveal, share sheet, "how the HOF works") become collapsible sub-sections or follow-up flows only where the route already supports them — I won't invent new sub-routes.

### A. Story Stream — `src/routes/_authenticated/stream.tsx`
Replace the current card layout with the mockup's:
- Sticky cream topbar with logo + alias pill.
- Stories rendered as `.story` cards with header (author bubble + name/sub + category pill), body with italic question, verdict bar + dot legend, action row (`Judge this` / `Happened to me` / share).
- Interleaved `.bench-line` nudges every ~2 cards (uses real counts).
- Inline `.hof-strip` card and `.scan-card` interleaved at fixed positions.
- Footer `.chatbot-pill` (already present as BenchPillMenu — keep, restyle to match the cream pill in the mockup).

### B. Court — `src/routes/court.tsx`
Rebuild around the mockup's case room:
- Topbar with live-pill ("Family Court · Live") tied to the current case tier.
- `.case-hero` (pink) with eyebrow / title / italic question / `⏱ N left` timer.
- `.parties-grid` (Plaintiff / vs / Defendant) cards, teal-top / coral-top borders, with quote or empty-chair note.
- `.section` for live verdict with 7-segment `.vbar` + dot legend (Red flag / Green flag / Run / Talk it out / Lawyer up / Therapy / Need update).
- Jury box: `.bench-strip` for The Bench, `.seats-row` with seat states (you / filled / empty + voted-* tint).
- 2-col verdict grid `.vgrid` with `.vbtn vk-*` active styles.
- Judgment grid `.jgrid` (Guilty / Not guilty / Both at fault / Need more info).
- Bench reaction strip + CTA button. Wires to existing verdict mutation.

### C. Scan — `src/routes/_authenticated/scan/index.tsx`
Rebuild as the dramatic chat entry:
- `.hero-banner` (ink) with pink orbs, "What happened? Don't soften it.", live-dot count of cases assessed today.
- Chat column with `.brow-msg` AI bubbles, `.user-msg` user bubbles, `.react-msg` dramatic AI reactions (pink left border on `.pk-l`).
- Dynamic input cards: emoji intensity row, tag cloud, tap-card 2×2 grid — wired to the existing scan question state machine. Each scan step picks the input type the mockup defines for that step.
- Score reveal screen (route `scan/result.$scanId.tsx`): `.score-hero` (ink with 120px ghost number), big score, gradient bar, `.insights` list, verdict preview card, action row (Save / Post to feed).

### D. Spill — `src/routes/_authenticated/spill/index.tsx`
Rebuild matching the Spill flow:
- `.spill-hero` (ink) — "Tell the court what happened." with the three rules dots.
- `.prog` 5-step progress bar (Opening / Context / The incident / After / Ready).
- Chat column with `.ai-row` / `.usr-row` and the critical `.short-card` ("The court needs more than this") that fires when the user types < ~40 words — wired to client-side word count.
- `.depth-prompt` (purple) for The Bench's drill-down questions.
- `.richness` meter card showing 4 facets (What happened / Context / His response / After) — driven by per-step completion.
- Input area with character count + send button (already wired).
- Privacy scan card + review card + auth block (existing logic, restyled).

### E. Hall of Fame — new route `src/routes/_authenticated/hof.tsx`
HOF doesn't exist as a standalone route yet. Create it:
- `.hof-hero` (ink) — gold crown, "Hall of Fame", three stat tiles.
- `.period-row` (Today / This week / This month / All time) — local state, no server filter yet.
- Legend (gold / teal / purple) explaining the 3 source types.
- Three category sections, each fed by an existing server function or temporary stub when no data exists:
  - **Court verdict** card (gold tint, gavel flag, bench declaration, outcome row) — `topByCategory("court")`.
  - **Stream story** card (teal tint, "Why it's here" resonance block) — top by relate count.
  - **Top juror** card (purple tint, avatar, 4 score stats, badges) — top from `user_scores` / `user_roles`.
- Wire the existing "🏆 Hall of Fame" strip in stream + the BenchPillMenu HOF item to `/hof` instead of `/court`.

## Pass 3 — Glue

- Update `BenchPillMenu` HOF entry → `/hof`.
- Ensure every new route file has `head()` meta (title + description) per the route-architecture rules. None get an `og:image` (no hero image yet).
- Smoke-check the build (route IDs match filenames, no missing imports).

## What I will NOT do in this pass

- Will not redesign auth/onboarding/profile routes (out of scope).
- Will not add new database tables or RLS policies — HOF reads from what already exists; if a stat has no source, it renders with a Bench-voice empty state, not a fake number.
- Will not implement the secondary "How the HOF works" explainer page, the Scan share sheet, or the Spill auth-block sub-screens — those exist in the mockups as supporting screens; I'll add them in a follow-up if you want.
- Will not change the existing chat-pill menu's 5-CTA structure; only the HOF target route changes.

## Estimated change size

~1 token-and-utility pass + 5 route rewrites + 1 small glue edit. Each route file lands around 250–400 lines.

## Approve to proceed?
Once you say go, I'll execute all 5 rebuilds in parallel batches and report back with the routes touched.
