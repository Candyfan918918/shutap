## Why the inconsistency exists

There are currently **two different unauthenticated flows** in the courtroom area:

1. **The "reel spinner" flow (IdentityCeremony)** — used by the teaser feed cards and the "Join to see verdicts" CTAs on `/` (`src/routes/index.tsx`). Clicking these calls `useGateStore.enqueue(...)`, which sets `gateOpen = true`, blurs the page, and mounts `<IdentityCeremony />` — the slot-machine alias reveal + age gate + auth.

2. **The plain `/enter` redirect flow** — used by `CourtroomPanel.tsx` (vote, judgment, submit, like, share, comment input) and `CommentThread.tsx` ("sign in to comment" link). These call `navigate({ to: "/enter", search: { redirect } })` or render a `<Link to="/enter">`, sending the user away from the page with no ceremony.

The cause is wiring, not intent: `CourtroomPanel` is rendered both on `/` (which mounts `IdentityCeremony`) AND on `/court` (which does not), so the earlier fix wired it to `/enter` to avoid a dead button on `/court`. The ceremony is also not mounted globally, so any component using `enqueue` only works on pages that happen to render `<IdentityCeremony />`.

## Plan: one gate, everywhere

### 1. Mount `IdentityCeremony` once, at the root

Move the `<AnimatePresence>{gateOpen && <IdentityCeremony />}</AnimatePresence>` block out of `src/routes/index.tsx` and into `src/routes/__root.tsx`, alongside the existing root-level providers. Read `gateOpen` from `useGateStore` there. Result: any component on any route can call `enqueue(...)` and the ceremony will play in place.

Also move the page-blur effect (the `motion.main animate={gateOpen ? blur : none}`) into a small wrapper so it still works on `/`. The blur is `/`-specific polish — keep it scoped to `index.tsx`; do not promote it.

### 2. Replace every direct `/enter` jump in the courtroom with `enqueue(...)`

In `src/components/court/CourtroomPanel.tsx`:

- Delete `requireAuth()` (the `navigate({ to: "/enter" })` path) and the local `isAuthed` state's role as a redirect trigger. Keep `isAuthed` only if needed for UI affordances (e.g. "Sign in to address the court" placeholder).
- Add `const enqueue = useGateStore(s => s.enqueue)`.
- Map each CTA to a `PendingAction`:
  - `pickVote(kind)` → `enqueue({ type: "vote", entityId: c.post.id, verdictKind: kind, context: { category: c.post.scoreCategory } })`
  - `pickJudgment(kind)` → `enqueue({ type: "judgment", entityId: c.post.id, ... })`
  - `onSubmit()` → same as `vote` (the panel's submit replays the chosen verdict)
  - `submitComment()` → `enqueue({ type: "comment", entityId: c.post.id, draftText: draft })`
  - `toggleLike()` → `enqueue({ type: "relate", entityId: c.post.id })`
  - `shareCase()` → `enqueue({ type: "teaser", entityId: c.post.id })`
  - Comment input `onFocus` → same `comment` enqueue, then blur.
- When the user IS authed, run the real path (the existing `cast(...)` call, optimistic state, etc.) — unchanged.

### 3. Replace the `CommentThread` "sign in" Link with the same gate

In `src/components/posts/CommentThread.tsx` (line 199), swap the `<Link to="/enter">` for a `<button onClick={() => enqueue({ type: "comment", entityId: postId })}>`. Same visual styling, same destination, but it now goes through the ceremony.

### 4. Resume after sign-in (already half-built — finish it)

`IdentityCeremony.tsx` already stashes/replays a `PendingAction` via `RESUME_KEY` in `sessionStorage`, and `index.tsx` has a `tryResume` listener on `onAuthStateChange`. Move that resume listener into the same root-level slot (next to where `IdentityCeremony` is mounted) so the replay works on `/court`, `/post/:id`, etc. — not just on `/`.

### 5. Sanity checks after the change

- On `/court` (signed out), click "Cast verdict" → ceremony opens, alias reel spins, OTP/OAuth, alias claim, vote auto-submits, ceremony closes. Same UX as the `/` teaser cards today.
- On `/` (signed out), behavior is identical to before — no regression in the blurred-main animation.
- On `/post/:id` (signed out), the "sign in to comment" link now opens the ceremony instead of navigating away.
- Signed-in users never see the ceremony — `enqueue` short-circuits via the existing `if (authed)` branch and `castVerdict` / etc. run directly.

## Files touched

- `src/routes/__root.tsx` — mount `<IdentityCeremony />` + the resume listener once.
- `src/routes/index.tsx` — remove the local `<IdentityCeremony />` mount and the duplicate resume effect. Keep the blur animation.
- `src/components/court/CourtroomPanel.tsx` — replace `requireAuth` + `navigate("/enter")` calls with `useGateStore().enqueue(...)` per CTA.
- `src/components/posts/CommentThread.tsx` — swap the `/enter` Link for a button that calls `enqueue`.

No backend, schema, or routing changes. No new dependencies.