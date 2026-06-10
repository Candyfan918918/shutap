# Onboarding & Auth Hardening Plan

The biggest win is structural: **one onboarding route, one profile bootstrap, one session check**. Everything else hangs off that. I'll batch this into 4 phases so each phase is independently shippable and reviewable.

## Decisions (need confirmation before phase 1)

1. **Canonical onboarding surface:** `/welcome` (full page). Delete the DOB/alias logic from `IdentityCeremony`; keep the overlay only as a *sign-in* prompt for anonymous users hitting a protected action. After sign-in, the overlay closes and the resume key sends them through `/welcome` if onboarding is incomplete.
2. **Canonical post-onboarding destination:** `/court` (you mentioned it; current code defaults to `/`). Make `/` redirect signed-in fully-onboarded users to `/court` only if no explicit `redirect` is set.
3. **Underage handling:** mark `profiles.blocked_reason = 'underage'` + sign out; do **not** delete the auth user. Block sign-in attempts at the gate for that user_id.
4. **Session truth:** `supabase.auth.getUser()` everywhere identity matters (it re-validates). `getSession()` only for token attachment.

If any of these are wrong, tell me before I start phase 1.

---

## Phase 1 — Structural unification

- **Strip onboarding from `IdentityCeremony`**: remove DOB, spin, reveal, claim, age-gate code. Keep only the auth card (email OTP + Google/Apple) for replay-pending-action sign-in. After successful sign-in, the resume handler in `GateRoot` checks `getMyIdentity()`; if onboarding incomplete → `window.location.assign('/welcome?redirect=…')`.
- **Single profile bootstrap**: create `src/lib/profile/bootstrap.server.ts` exporting `ensureProfile(userId)` used by `finalizeIdentity`, `verifyAge`, and the SQL `handle_new_user` trigger stays as defense-in-depth but is no longer relied on. Remove inline profile insert from `verifyAge`.
- **Single session helper**: `src/lib/auth/get-valid-user.ts` becomes the only client-side check. Internally use `getUser()`. Delete ad-hoc `getSession()` calls in onboarding code.
- **Welcome resumability**: on mount, branch on `(ageVerified, aliasClaimed)`:
  - `(false, *)` → DOB
  - `(true, false)` → spin
  - `(true, true)` → redirect

## Phase 2 — Server-side correctness

- **Protect `generateAlias`** with `requireSupabaseAuth` + require `age_verified=true` in handler (return `{error: 'age_not_verified'}` if not). Update `welcome.tsx` to only call after `verifyAge` succeeds.
- **Race-safe `claimAlias`**: catch unique-violation (`23505`) and return `{ ok: false, reason: 'taken' }`. Client shows "Someone else just claimed that. Spin again." and resets to spin.
- **Underage path**: `verifyAge` writes `profiles.blocked_reason = 'underage'`, `blocked_at = now()`, then `supabase.auth.signOut()` server-side. No `deleteUser`. Add a check at top of `requireSupabaseAuth` (or a thin wrapper) that 403s blocked users.
- **Migration**: add `profiles.blocked_reason text`, `profiles.blocked_at timestamptz`; add partial unique index on `(nationality, emotion, creature)` where all three are not null (it may already exist — verify and add only if missing).

## Phase 3 — Error visibility & UX

- Remove every silent `.catch(() => {})` in `IdentityCeremony` and `welcome.tsx`. All catches log + set a visible error state (already started this in welcome.tsx).
- DOB form: wrap in `<form onSubmit={…}>`, button `type="submit"`. Same for OAuth buttons stay as `type="button"`.
- Add a "post-redirect session diagnostics" panel on `/welcome` (dev-only, behind `import.meta.env.DEV`) showing: session present, userId, ageVerified, aliasClaimed.
- Toast + inline error for: finalizeIdentity, verifyAge, generateAlias, claimAlias. Retry button always re-runs the failed step, not the whole flow.

## Phase 4 — Tests & operational checks

- Vitest suites in `src/__tests__/onboarding/`:
  - `new-oauth-user.test.ts` — new user → DOB → alias → /court
  - `returning-age-verified-no-alias.test.ts` — skip DOB, land on spin
  - `fully-onboarded.test.ts` — bypass /welcome entirely
  - `underage.test.ts` — block screen + signed out + profile flagged
  - `alias-conflict.test.ts` — second claimer gets `taken` → resets to spin
  - `missing-auth-header.test.ts` — protected fns return 401
- Add `src/lib/health/schema-check.server.ts` server fn that selects 1 row touching `age_verified, dob_month, dob_year, nationality, emotion, creature, blocked_reason` and returns missing columns. Wire into `/admin` page.
- Document required OAuth redirect URLs in `docs/auth-setup.md`:
  - `https://shutap.lovable.app/welcome`
  - `https://id-preview--29d52b59-0fed-4a8a-a2b3-eab0b9ac8c47.lovable.app/welcome`
  - `http://localhost:5173/welcome`
  - (legacy IdentityCeremony paths removed in phase 1, so no extra URLs needed)

---

## Technical details

- `requireSupabaseAuth` enhancement: extend context to `{ supabase, userId, claims, profile: { age_verified, alias_claimed, blocked_reason } }` via a single profile fetch, so handlers don't each re-query. One round trip per protected call.
- `ensureProfile(userId, supabaseAdmin)`: upsert on conflict `id` do nothing, returning the row. Used only in `finalizeIdentity` after auth. The DB trigger remains as a safety net.
- Unique index: `CREATE UNIQUE INDEX IF NOT EXISTS profiles_alias_unique ON profiles (nationality, emotion, creature) WHERE nationality IS NOT NULL;`
- Blocked check: cheapest in middleware (already fetching profile). Returns 403 `{error:'account_blocked'}`. Client catches and routes to `/blocked` page.
- Test infra: mock `@/integrations/supabase/client` and the server-fn wrappers; assert state transitions and toasts.

## Out of scope (call out, don't fix here)

- Item 7 (OAuth redirect URL allowlist) is a dashboard config, not code. I'll document the exact URLs but you'll need to add them in Lovable Cloud → Users → Auth Settings → Google.
- Phasing out `lovable.auth.signInWithOAuth` for raw `supabase.auth.signInWithOAuth` — not recommended; the broker is the supported path for managed OAuth on Lovable Cloud.

---

**Smallest atomic ship:** Phase 1 alone removes 90% of "works in one place not the other" bugs. I'd recommend approving phase 1, shipping, smoke-testing, then approving phase 2.
