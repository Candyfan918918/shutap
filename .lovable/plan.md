# Identity & Login System — "You've been assigned a character"

A login flow that doesn't feel like signup. Three taps, an IP-aware reveal animation, and the user lands in `/{locale}/home` already a named character.

## 1. Auth methods (no passwords)

- **Email OTP** (primary) — `supabase.auth.signInWithOtp({ email })` → 6-digit code screen → `verifyOtp`. No password fields, anywhere.
- **Google** — via Lovable broker `lovable.auth.signInWithOAuth("google", …)`.
- **Apple** — via Lovable broker `lovable.auth.signInWithOAuth("apple", …)`.
- Backend toggles: enable Google + Apple via the social-auth config, disable password sign-in, keep email enabled for OTP, do NOT auto-confirm.

## 2. Routes (mobile-first)

```text
/enter                      single-screen auth (email field + Google + Apple)
/enter/verify               6-digit OTP entry (auto-advance, paste-friendly)
/welcome                    cinematic identity-reveal animation (one-time)
/{locale}                   localized home (zh, en, ja, es, pt, fr)
/_authenticated/*           anything that requires a session
```

The auth gate is the existing `_authenticated` pathless layout — public routes (`/`, `/post/:id`, `/enter*`) stay outside it.

## 3. IP + geo localization engine

Server function `resolveGeoFromRequest()` reads the `cf-ipcountry`, `cf-ipcity`, `cf-region`, `accept-language` headers (Cloudflare Workers populates these for free) and falls back to a free IP lookup if missing. Returns `{ country, region, city, locale }`. The locale is derived as: city-country map → preferred language; overridden by stored `profiles.locale` once the user exists.

On first login this geo blob is persisted to `profiles` and used to seed the display name. On every visit it's also used to:
- pick the default `/{locale}/home` redirect,
- boost local leaderboard rows in `getLocalLeaderboard()`,
- tag new posts with `country/region/city`.

## 4. Auto display-name generator

```text
Display name = [Localized city]  ·  [Localized descriptor]
```

- `src/lib/identity/city-pools.ts` — curated per-country city pools written in the country's native script (北京 / Tokyo / Paris / Miami).
- `src/lib/identity/descriptor-pools.ts` — descriptor pools per language (zh / en / ja / es / pt / fr). Each descriptor carries a `vibe` tag (`elegant | wild | soft | sharp | dreamy | royal | playful`) that drives avatar colors.
- `generateDisplayName(geo)` picks city by country, descriptor by locale, joins with locale-aware separator (`·` for CJK, ` · ` for Latin), and re-rolls up to 5× if the result already exists in `profiles.nickname`.

## 5. Procedural avatar generator (no external image call)

Avatars are SVG data-URIs generated client + server side from a seed derived from `userId + descriptor.vibe`:
- vibe → 2-stop gradient palette (e.g. `wild` → crimson/violet, `elegant` → ink/champagne),
- seeded geometric ornament (rings, blobs, or sparkles),
- 2-character monogram from the city in the native script (北 / NY / 東 / PA).

Result: a 512×512 SVG stored as `profiles.avatar_url` (data URL kept short; ~2 KB). Zero AI cost, instant, theme-consistent, and easy to re-roll. A "Re-roll my character" button on the welcome screen regenerates name+avatar+vibe.

## 6. Database changes (single migration)

Extend `profiles` to capture the new identity fields and store one identity record per user. Existing rows are backfilled with safe defaults so RLS keeps working.

Added columns on `public.profiles`:
- `email text` — mirrored from `auth.users.email` via the existing `handle_new_user` trigger.
- `display_name text` — the generated "City · Descriptor".
- `avatar_url text` — SVG data URI.
- `vibe text` — descriptor vibe tag (drives avatar/UI accents).
- `descriptor text`, `city_label text` — raw parts for re-roll.
- `country_code text` — ISO 3166-1 alpha-2 (already had `country` text; this normalizes it).
- `onboarded_at timestamptz` — null until the welcome reveal is dismissed.
- `last_seen_at timestamptz`.

The existing `handle_new_user` trigger is replaced with a new version that:
1. inserts `profiles` with locale from `raw_user_meta_data`,
2. copies email,
3. picks a temporary nickname from the `nicknames` table so RLS-dependent code stays green,
4. leaves `display_name`/`avatar_url`/`onboarded_at` null — filled by the welcome screen via a `finalizeIdentity` server function so geo headers are available.

No new tables required (the `profiles` table already exists and is referenced everywhere).

## 7. Server functions

- `resolveGeoFromRequest()` — reads CF headers, returns `{country, region, city, locale}`. Used during OTP verify and welcome screen.
- `finalizeIdentity({ rerollSeed? })` — protected. Looks up profile, calls `generateDisplayName(geo)` + `generateAvatar(seed)`, writes the four identity fields, sets `onboarded_at` if first run, returns the full identity payload.
- `getMyIdentity()` — protected. Returns the current profile's identity block; used by `_authenticated` root to render the avatar in the top bar.

## 8. UI components

```text
src/routes/enter.tsx                  single-screen auth (email + Google + Apple)
src/routes/enter.verify.tsx           OTP entry with auto-advance inputs
src/routes/welcome.tsx                identity-reveal animation + re-roll + CTA
src/components/auth/EnterCard.tsx
src/components/auth/OtpInput.tsx
src/components/identity/AvatarSvg.tsx          renders SVG from vibe + seed
src/components/identity/IdentityReveal.tsx     framer-motion reveal sequence
src/components/identity/IdentityBadge.tsx      avatar + name pill for headers
src/lib/identity/city-pools.ts
src/lib/identity/descriptor-pools.ts
src/lib/identity/generate-name.ts
src/lib/identity/generate-avatar.ts            pure, seedable, returns SVG string
src/lib/geo/resolve.server.ts                  reads CF headers
src/lib/identity.functions.ts                  finalizeIdentity, getMyIdentity
```

Welcome screen sequence (≈3.5 s):
1. Black screen → spinning sigil while `finalizeIdentity` runs.
2. Avatar scales in with blur-out + drop shadow (spring).
3. Display name types in character-by-character.
4. Country flag + city label fade in below.
5. CTA pill "Enter the Marriage Drama Universe →" pulses.
6. Tiny "🎲 re-roll my character" link at the bottom calls `finalizeIdentity({rerollSeed})` again.

## 9. Localization wiring

Existing `I18nProvider` + `messages.ts` already covers 6 locales. We:
- add `enter.*`, `welcome.*`, and `identity.vibes.*` keys for all locales,
- detect locale via geo → stored profile locale → browser → `en`,
- after welcome, navigate to `/${locale}` (existing home is `/`; add a passthrough `/{locale}` route that renders the home and sets the I18n locale).

## 10. Security

- Email OTP rate-limited by Supabase Auth; we additionally short-circuit repeated sends from the same IP within 30 s in the server function.
- `finalizeIdentity` is idempotent: re-roll allowed, but `onboarded_at` only set once; cannot overwrite another user's row (`auth.uid()` enforced via RLS on `profiles`).
- Geo headers are server-only; client never receives the raw IP.
- No PII beyond email is stored. OAuth `name` and `picture` are deliberately discarded — the assigned identity is the only identity.
- Enable Supabase HIBP password check is moot (no passwords), but we still flip `disable_signup=false`, `auto_confirm_email=false`, `external_anonymous_users_enabled=false`.

## 11. Build order

1. Migration: extend `profiles`, update `handle_new_user` trigger.
2. `supabase--configure_social_auth` for Google + Apple; `configure_auth` to lock down policy.
3. Geo resolver + identity pools + pure generators (city/descriptor/avatar/name).
4. Server functions `finalizeIdentity` / `getMyIdentity` / geo helper.
5. `/enter` + `/enter/verify` screens with OTP flow.
6. `/welcome` cinematic reveal.
7. Wire `IdentityBadge` into existing top bar; redirect signed-in users from `/enter` → `/welcome` (if `onboarded_at` null) or `/{locale}` (otherwise).
8. i18n keys for all 6 locales.
9. Replace any "sign up / sign in" copy in existing screens with "Enter".

## Technical details

- **Geo source**: Cloudflare Workers headers (`cf-ipcountry`, `cf-region`, `cf-ipcity`, `cf-iplongitude`, `cf-iplatitude`). No external API call, no extra latency, no key to manage. Falls back to `accept-language` for locale and `'XX'` country if missing (local dev).
- **OTP UI**: 6 numeric inputs with `inputMode="numeric"`, auto-advance on key, paste-distribute on paste, auto-submit on 6th digit.
- **Welcome animation**: framer-motion + a tiny custom typewriter hook. No external libs.
- **Avatar SVG**: pure function `generateAvatar({seed, vibe, monogram}) → string`. Stored as `data:image/svg+xml;base64,...`. Average size 1.8–2.2 KB; well under any column limits and cacheable in `<img src>`.
- **Re-roll**: client passes `rerollSeed = Date.now()` so the server picks fresh descriptor + avatar; the city stays (city is geo, not random).
- **Locale routing**: `/` already renders the home; we add an optional `/{locale}` passthrough so deep-linked OG share URLs remain `/post/:id` (locale-free) while the post-welcome navigation hits `/zh`, `/en`, etc.
- **Cost**: zero per-user AI spend. If you later want AI portraits, swap `generateAvatar` for a Lovable AI image call — the rest of the system stays identical.

Shall I start with steps 1–4 (migration + auth config + pools + server functions) and then ping you before building the screens?
