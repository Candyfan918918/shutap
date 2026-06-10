# Auth & OAuth Setup

## Required OAuth redirect URLs (Google)

Add these to Lovable Cloud → Users → Auth Settings → Google provider:

- `https://shutap.lovable.app/welcome`
- `https://id-preview--29d52b59-0fed-4a8a-a2b3-eab0b9ac8c47.lovable.app/welcome`
- `http://localhost:5173/welcome`

Returning users without a completed alias also land on `/welcome`; no separate
callback URL is required because OAuth completes against the same route.

## Required server env

These are set as Supabase secrets (do not commit):

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY`

If `SUPABASE_SERVICE_ROLE_KEY` is missing, `verifyAge` and `claimAlias` will
fail with "supabaseAdmin" errors and onboarding stalls on the DOB screen.

## Onboarding flow contract

1. User hits a protected action or `/welcome`.
2. `IdentityCeremony` (overlay) handles sign-in only; on success it routes to
   `/welcome?redirect=<original>`.
3. `/welcome` calls `finalizeIdentity` → branches on `(ageVerified, aliasClaimed)`:
   - `(false, *)` → DOB form → `verifyAge`
   - `(true, false)` → slot machine → `generateAlias` → `claimAlias`
   - `(true, true)` → redirect to `redirect` or `/court`
4. Underage users are soft-blocked (`profiles.blocked_reason = 'underage'`)
   and signed out — their auth user is NOT deleted.
5. Alias-conflict race: `claimAlias` catches Postgres `23505` and returns
   `{ ok: false, reason: 'taken' }`; the client re-spins.

## Health check

`/admin` calls `schemaCheck` to verify required columns on `profiles`:
`age_verified, dob_month, dob_year, nationality, emotion, creature,
blocked_reason, blocked_at`. If anything is missing, ship the
`20260610030250_*` migration.
