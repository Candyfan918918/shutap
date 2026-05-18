# Fix: "Start Drama Scan logs me out"

## What's actually broken

The `_authenticated` route guard at `src/routes/_authenticated.tsx` calls
`supabase.auth.getUser()` inside `beforeLoad`. This makes a **network call
to Supabase on every protected navigation** to revalidate the JWT. If the
call is slow, the token is mid-refresh, or Supabase responds with anything
other than a valid user (which happens during normal navigation races),
the guard redirects you to `/enter` — even though your session is valid
in `localStorage`. That's the "logs me out" experience.

Two contributing issues make it worse:

1. The root has no `onAuthStateChange` listener that calls
   `router.invalidate()`, so after sign-in the router still has the stale
   "unauthenticated" match cached for `/scan`.
2. `supabase.auth.signInWithOtp` in `src/routes/enter.tsx` doesn't set
   `emailRedirectTo`, so the magic link (auth logs show
   `user_recovery_requested` — existing accounts receive a recovery-style
   link, not a 6-digit OTP) lands on an arbitrary URL where
   `detectSessionInUrl` may not run before the user clicks `/scan`.

## Fix

### 1. `src/routes/_authenticated.tsx` — use `getSession`, not `getUser`

Replace the network-bound check with a local-session check. `getSession()`
reads the persisted session from storage synchronously (no network), and
supabase-js auto-refreshes the token in the background. The server-side
`requireSupabaseAuth` middleware is still the real authority for data
access — the guard's only job is to keep unauthenticated users out of the
UI shell.

```ts
beforeLoad: async ({ location }) => {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw redirect({ to: "/enter", search: { redirect: location.href } });
  }
},
```

### 2. `src/routes/__root.tsx` — wire `onAuthStateChange` once

Inside `RootComponent`, subscribe to auth changes and invalidate the
router + react-query cache so protected routes re-evaluate after sign-in
/ sign-out / token refresh. Mirrors the pattern documented in the
TanStack + Supabase knowledge file.

```tsx
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
    router.invalidate();
    queryClient.invalidateQueries();
  });
  return () => subscription.unsubscribe();
}, [router, queryClient]);
```

### 3. `src/routes/enter.tsx` — set `emailRedirectTo` on OTP

So that magic-link clicks land on `/welcome` where the Supabase client
parses the URL hash and persists the session before any navigation to
protected routes.

```ts
await supabase.auth.signInWithOtp({
  email,
  options: {
    shouldCreateUser: true,
    emailRedirectTo: `${window.location.origin}/welcome`,
  },
});
```

### 4. (Defensive) `/welcome` — wait for session before showing CTAs

Add a tiny effect on `src/routes/welcome.tsx` that awaits
`supabase.auth.getSession()` once on mount. This guarantees that by the
time the user clicks "Start Drama Scan", the session is hydrated and the
guard will see it.

## Out of scope

- No changes to scan logic, scoring, DB schema, or RLS.
- No new routes.
- Server-side `requireSupabaseAuth` middleware stays as-is (it's the
  correct authority for protected server functions).

## Files changed

- `src/routes/_authenticated.tsx` (swap getUser → getSession)
- `src/routes/__root.tsx` (add onAuthStateChange + router.invalidate)
- `src/routes/enter.tsx` (add emailRedirectTo)
- `src/routes/welcome.tsx` (await session on mount)
