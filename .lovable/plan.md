## Problem

The bootstrap success screen in `src/routes/admin.login.tsx` displays the TOTP setup as a raw `otpauth://...` text string — there was never a scannable QR code. Your admin account was created, but the secret was never added to an authenticator app, so the 6-digit code step can't be passed. Bootstrap is now closed because an admin row exists.

## Plan

### 1. Reset the existing admin
- Run a migration that deletes all rows from `admin_users`, reopening the bootstrap flow on `/admin/login`.

### 2. Show a real QR code on the bootstrap-done screen
- Add the `qrcode.react` package.
- In `admin.login.tsx`, render the `otpauth` URL as a scannable QR code (white background panel so phone cameras can read it), alongside:
  - the manual-entry base32 secret (with a copy button)
  - a clear warning that this is shown exactly once
- Keep the "Continue to login" button below.

### 3. You re-bootstrap
- Visit `/admin/login`, click the bootstrap link, create your super admin again (password 12+ chars), scan the QR with Google Authenticator / 1Password / Authy, then sign in with email + password + 6-digit code.

## Technical details
- Migration: `DELETE FROM public.admin_users;` (safe — table only holds the one orphaned admin).
- QR rendering is client-side only (`ssr: false` already set on the route), so no server changes needed beyond nothing — `auth.functions.ts` already returns `{ otpauth, secret }`.