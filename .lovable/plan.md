## Problem

`PrimaryNav` (which contains the signed-in identity badge + dropdown to `/me`) is defined in `src/components/nav/PrimaryNav.tsx` but **never imported anywhere**. Each route (`/court`, `/post/:id`, `/u/:handle`, `/`, `/enter`, `/settings`, `/spill`, `/admin`, …) renders its own small `<header>` with just a back link and maybe a streak chip — no avatar, no menu. That's why you don't see the badge on `/court`.

## Fix

Extract the avatar-pill + dropdown from `PrimaryNav` into a small reusable component, then mount it once in the root layout so it appears on every page's header without touching each route.

### 1. New `src/components/nav/IdentityBadge.tsx`
Lifted from `UserMenu` inside `PrimaryNav.tsx`. Three states:
- **Signed-in + identity ready** → avatar pill (`AvatarSvg` + display name on ≥sm) that opens a dropdown with: My profile, My posts, My scans, New post, Settings, Sign out.
- **Signed-in, no alias yet** → "✨ Finish onboarding" link to `/welcome`.
- **Signed-out** → "Enter →" link to `/enter`.

Uses the same `getMyIdentity` server fn and `supabase.auth.onAuthStateChange` wiring that's already in `PrimaryNav`.

### 2. Mount globally in `src/routes/__root.tsx`
Add a fixed top-right slot inside `RootComponent` so it floats above every route's local header on every page — consistent with the Bench doctrine of an alias overlay rather than full top nav.

```tsx
<QueryClientProvider client={queryClient}>
  <Outlet />
  <div className="fixed top-2 right-3 z-[60]">
    <IdentityBadge />
  </div>
  <GateRoot />
</QueryClientProvider>
```

The badge is small enough to sit beside the existing per-route headers (back link on the left, streak chip in the middle/right). No per-route edits needed.

### 3. Delete the now-unused `PrimaryNav.tsx`
It violates the AI-native doctrine (tabs/links) and is never referenced. Removing it avoids two competing nav systems.

## Out of scope
- Restyling existing per-route headers
- Adding a tab bar / bottom nav
- Changing what's inside the dropdown
