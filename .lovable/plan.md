## Goal

Redesign `src/routes/index.tsx` to match the uploaded `shutap-landing.html` reference, ported to project tokens, with the featured case kept **live** (countdown, live verdict bar, jury seats, vote + judgment buttons). Every interactive control on the landing routes the user to sign-in.

## Constraints

1. **No tabs anywhere.** The reference nav is anchor links — keep it that way; no tabbed sub-nav inside Court/Stream/HOF.
2. **Featured case is LIVE.** Countdown ticking, "Live verdict — N votes cast", animating seats, vote grid + judgment grid + submit button all present and clickable.
3. **All buttons → sign-in.** No real mutations from `/`. Every CTA, vote chip, judgment chip, submit button, docket card, HOF card, stream card click navigates to `/auth?redirect=/...` (or `/enter` — whichever the project's sign-in route is; will confirm from the routes tree). Done with a single `<Link>` wrapper / shared `onClick` handler — no auth ceremony, no inline modals.

## Sections

1. **Nav** — `SHUTAP` wordmark · `#court` `#stream` `#hof` anchors · `Spill it` pill → `/auth?redirect=/spill`.
2. **Hero** — Serif "Spill it. / The court decides.", sub, primary "Open a case" + ghost "Enter the court" (both → sign-in), animated keyword pills, count-up of `totalVerdicts`, ghost SHUTAP wordmark drifting behind.
3. **Court ribbon** — Eyebrow `Relationship Court™ · Where the human decides`, serif H1, italic sub, live pill `N cases in session · M jurors active` (real numbers from `getHomepageData()` if available; otherwise the existing values already on the page).
4. **Featured LIVE case** — see below.
5. **Docket** — 3 live-case cards from `liveCases`, each card click → sign-in.
6. **Hall of Fame** — Dark block, gold accents, 3 stat tiles + 3 HOF cards from `hofEntries` / `hofStats`. Cards → sign-in.
7. **Stream** — 3-column masonry from `streamStories`. Cards → sign-in.
8. **SEO block** — Preserve existing AITA-alternative / am-I-wrong long-form copy.
9. **Footer** — Existing footer links.

## Featured case block (LIVE)

Pulled from `liveCases[0]` returned by `getHomepageData()`.

- **Case hero card** — eyebrow `Case · {category} Court · {tier} tier`, serif title (the post `case_title` / `title`), italic AI-question line (`question_before_court`), ticking countdown chip `⏱ {hh:mm:ss} until verdict locks` computed client-side from `verdict_lock_at` via `setInterval(1000)` + `prefers-reduced-motion` short-circuit.
- **Parties** — Plaintiff card (emoji, role, alias name, `Testimony filed` status, quote) `vs` Defendant card (emoji, role, alias name, `No response yet` status, "The other chair is empty. The court proceeds regardless." italic). Data taken from the case's perspectives if present, otherwise the reference's example as static fallback content under a single `if (!featuredCase) return …` guard.
- **Live verdict bar** — 4 segments (NTA / Everyone sucks / Need more info / YTA) widths animate from 0 → final percentages on first in-view. Pulls real tallies from the case if exposed; falls back to the example percentages otherwise. Label: `Live verdict — {voteCount} votes cast`.
- **Jury seats** — Dark block, `⚖️ The Bench · Hon. Public Opinion` title, `{count} seated` gold count, 6×N grid of seat tiles. Filled seats animate in staggered (`seatIn` keyframe with per-seat `animation-delay`), one ticker line below.
- **Vote grid** — 3-button row (NTA / YTA / ESH plus the project's actual verdict kinds: `red_flag` `green_flag` `run` `talk_it_out` `lawyer_up` `therapy_might_help`). Render the 3 most-voted at the top, plus a `See all verdicts ↓` row that also routes to sign-in.
- **Judgment grid** — 4-button row of mini reactions (`hug` `laugh` `drama` `been_there` mapped to the `reaction_kind` enum).
- **Submit button** — full-width dark, `Cast your verdict`, all variants route to sign-in.
- **Trust line** — `Anonymous. Real people. No bots.`

Every button in this block shares a single handler:
```tsx
const goSignIn = () => navigate({ to: "/auth", search: { redirect: "/" } });
```
The vote/judgment selection visual state (`.sel` highlight) is purely local React state and resets after the redirect intent — fine for the unauth landing since the redirect is immediate.

## Design tokens

Reference colors → project tokens in `src/styles.css`:

| Reference            | Token                |
| -------------------- | -------------------- |
| `#880040` deep pink  | `--c-pink-deep`      |
| `#fdfcfb` page       | `--c-surface`        |
| `#f7f4f2` panel      | `--c-surface-2`      |
| `#0a080f` ink        | `--c-text-1`         |
| `#7a6e78` muted      | `--c-text-2`         |
| `#b0a4ae` faint      | `--c-text-3`         |
| `rgba(10,8,15,.1)`   | `--c-border`         |
| `#1a9e82` green flag | `--c-green` (add if missing) |
| `#c8960a` HOF gold   | `--c-gold` (add if missing) |
| `#d4860a` amber      | `--c-amber` (add if missing) |
| `#6b4fa0` violet     | `--c-violet` (add if missing) |

Fonts (`DM Serif Display`, `Sora`) already loaded in `src/styles.css` — verify; add the `@import` if missing.

No hex codes in JSX. Missing tokens get added to `:root` and consumed via Tailwind utilities (`bg-c-pink-deep`, `text-c-gold`, etc.).

## Animation

Pure CSS keyframes in `src/styles.css`, gated by `prefers-reduced-motion`:

- `fadeUp` — hero text, staggered with delay classes (reuse existing `section-reveal` / `in-view`).
- `ghostDrift` — giant ghost wordmarks behind hero / court ribbon / case hero.
- `pulse` — live status dots.
- `goldGlow` — HOF trophy.
- `seatIn` — jury seats stagger.
- Verdict bar widths animate via inline `style={{ width }}` + CSS transition on first in-view.
- Countdown timer ticks via `setInterval`, paused under reduced motion (just shows static remaining time).

## Data

Reuse `getHomepageData()` in `src/lib/marketing/homepage.functions.ts` (already returns `liveCases`, `hofEntries`, `hofStats`, `streamStories`, `totalVerdicts` per the existing imports). No backend changes. Fields not yet returned (per-kind vote tally for the featured case, jury seat count, perspective quotes) are optional decoration — if missing, render reference-style example content. No new tables, no new server fns.

## Files touched

- `src/routes/index.tsx` — full restructure.
- `src/styles.css` — add 3–4 missing tokens + any missing keyframes (`ghostDrift`, `goldGlow`, `seatIn`, `pulse`) only if not present.

## Out of scope

- Any actual auth ceremony on `/` (clicks just redirect).
- Real-time vote streaming.
- Authenticated stream / chatbot pill / alias overlay.
- Backend changes.

```text
hero → court ribbon → LIVE featured case (countdown + live bar + seats + vote + judgment + submit)
     → docket (more live cases) → HOF (dark) → stream masonry → SEO → footer
        every interactive control → /auth?redirect=/
```
