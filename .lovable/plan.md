
# Light, Warm, Calm — Design System Overhaul

Flip Shutap from dark doom-scroll to warm-light reading surface. One coral accent, soft pastel category tags, serif headlines, calm everywhere.

## 1. Token rewrite (`src/styles.css`)

Replace the current dark-first token set. All values in `oklch` (no hex in components), but converted from the targets you gave:

- `--background`: warm white `#FFFDF9` → `oklch(0.99 0.005 80)`
- `--foreground`: near-black ink `oklch(0.22 0.01 60)` (warm, not pure black)
- `--surface`: `oklch(0.975 0.008 75)` (card on bg)
- `--surface-elevated`: `oklch(0.96 0.01 75)`
- `--border`: `oklch(0.22 0.01 60 / 10%)`
- `--muted-foreground`: `oklch(0.5 0.015 60)`

Single action color (coral `#E8602A`):
- `--primary`: `oklch(0.66 0.18 40)`
- `--primary-foreground`: `oklch(0.99 0.005 80)`
- `--primary-glow`: removed (no glow on light)
- `--ring`: same as primary
- `--destructive`: keep but desaturate to a calm rust `oklch(0.58 0.14 35)` — used only for true destructive actions (delete), never as ambient brand color

Kill these tokens entirely (and any utilities that reference them):
- `--score-low/-mid/-high/-legendary` gradient stops
- `.ring-danger`, `.gradient-score`, `.bg-grain` (replace grain with a much softer paper texture or drop)
- `--primary-glow` references in components

Category accent palette — soft pastel fills used by tags/badges only (low chroma, high lightness):
- `--tag-pink`: `oklch(0.93 0.04 20)` fg `oklch(0.45 0.12 25)`
- `--tag-peach`: `oklch(0.94 0.05 60)` fg `oklch(0.48 0.13 45)`
- `--tag-sand`: `oklch(0.94 0.04 85)` fg `oklch(0.45 0.08 70)`
- `--tag-sage`: `oklch(0.93 0.03 150)` fg `oklch(0.42 0.08 150)`
- `--tag-sky`: `oklch(0.93 0.035 230)` fg `oklch(0.45 0.1 240)`
- `--tag-lilac`: `oklch(0.93 0.04 300)` fg `oklch(0.45 0.12 300)`

Score tiers no longer drive color. Tier is communicated through copy + a single coral progress fill (intensity via opacity/width, not hue).

Dark mode: drop `.dark` overrides for now (app is light-first). Keep `color-scheme: light` on `html`.

## 2. Typography

Load via `<link>` in `src/routes/__root.tsx` head() — never `@import` URLs in CSS:
- DM Serif Display (400)
- DM Sans (400, 500, 600, 700)

In `@theme`:
- `--font-display: "DM Serif Display", Georgia, serif;`
- `--font-body: "DM Sans", system-ui, sans-serif;`

Add a `.font-display` utility and apply it to:
- Story titles in `FeedCard`, `PostRow`, `post.$postId` hero
- ScoreCard headline title (the "story quote" line)
- Section headers on `/court`, `/me`, `/u/$handle`
- ScoreReveal big number stays sans (tabular numerals look better in DM Sans)

Body everywhere uses DM Sans. Bump base line-height to `1.6` for story bodies.

## 3. ScoreCard & share-card recolor

`src/components/post-engine/ScoreCard.tsx`:
- Drop the 5-tier gradient. Single card style: warm cream background `oklch(0.97 0.015 75)`, coral score number, ink-black title in DM Serif Display, pastel badge chips.
- Remove the dark overlay on media; instead a soft white scrim `bg-white/60`.

`src/lib/share/card-svg.ts`:
- Replace `TIER_GRADIENTS` with one shared cream→peach gradient (`#FFFDF9` → `#FFE9D6`) and coral accent.
- Score number in coral `#E8602A`; title in `#1A1410` DM Serif Display.
- Update `FONT_FAMILY` to include `"DM Serif Display"` for title text and `"DM Sans"` for the rest.

## 4. Component sweep

Targeted edits, no behavioral changes:
- `FeedCard.tsx`, `PostRow.tsx`, `StoryArc.tsx`, `CourtCaseCard.tsx`, `CountdownChip.tsx`, `VerdictBar.tsx`, `ScoreReveal.tsx`, `ProfileHeader.tsx`, `PrimaryNav.tsx`: swap any `bg-black/…`, `from-[oklch(...)]`, hard-coded gradient classes, and `ring-danger` for the new tokens. Verdict bar fill becomes solid coral at varying widths.
- "⚖️ In Court" ribbon: change from red urgency to coral on cream.
- Court countdown chip: calm — coral text on peach pill, no pulse-glow.
- Category tags: cycle through the 6 pastel tag tokens by category key (stable hash → color).

## 5. Cleanup

- Remove `bg-grain`, `ring-danger`, `gradient-score` utility classes after callsites are migrated.
- Search for stray `text-white`, `bg-black`, `from-[oklch(0.6…)]` literals and replace with tokens.
- Verify `OG`/share images still look right after `card-svg.ts` rewrite.

## What is NOT changing

- No route, data, server-fn, or schema changes.
- Score math, verdicts, court lifecycle, story arcs, notifications — all untouched.
- Layouts and component structure stay; only colors, fonts, and a few overlays change.

## Files touched (approx)

- `src/styles.css` (token rewrite)
- `src/routes/__root.tsx` (font link tags)
- `src/components/post-engine/ScoreCard.tsx`
- `src/lib/share/card-svg.ts`
- `src/components/posts/FeedCard.tsx`, `PostRow.tsx`, `StoryArc.tsx`, `VerdictBar.tsx`
- `src/components/court/*` (CourtCaseCard, CountdownChip, CourtTabs, HonorBadge)
- `src/components/scan/ScoreReveal.tsx`
- `src/components/profile/ProfileHeader.tsx`
- `src/components/nav/PrimaryNav.tsx`
- Any remaining components using removed tokens (grep-driven sweep)
