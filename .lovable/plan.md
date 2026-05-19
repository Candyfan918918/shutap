
# Profile + Settings + Post Management System

Goal: TikTok-style anonymous profile (`/u/$handle`) with identity customization, social graph, content tabs, full settings, and **per-post management with analytics** (publish/delete/visibility + views, likes, shares, forwards).

## Scope (in this build)

1. Database schema — handles, bios, avatars, follows, friendships, saved posts, blocks, post visibility, view tracking
2. Public profile route `/u/$handle` — header + 4 tabs (Stories, Chaos History, Saved Tea, Badges)
3. Settings hub `/settings/*` (Account, Identity, Privacy, Notifications, Language, Safety, Data)
4. Identity flows: edit display name, change @handle (live availability + suggestions), shuffle nickname, upload avatar, AI avatar generation, anonymous mode
5. Social: Follow (one-way) + Friend request (mutual, accept/decline)
6. **My Posts** dashboard `/me/posts` with tabs: Published · Drafts · Private
7. **Per-post management**: publish, unpublish (→ private), make public, delete, edit, copy share link
8. **Per-post analytics**: views, likes, comments, shares (per platform), saves, friend-forwards
9. Anonymous view tracking (lightweight, deduped per session)

Deferred (called out so we don't regress):
- DMs (spec says "later")
- Real push notification delivery (only toggles persisted)
- Full data export (button shows "coming soon")
- Compare-scores friend feature
- Multi-style AI avatar presets (one generic AI generate button)

## Database changes (single migration)

### Extend `profiles`
- `handle text UNIQUE` — lowercase `^[a-z0-9_]{3,24}$`
- `bio text` (max 200)
- `anonymous_mode boolean default true`
- `avatar_kind text` — 'upload' | 'ai' | 'default'
- `notif_prefs jsonb default '{}'`
- `privacy jsonb default '{}'`

Backfill `handle` from slugified `nickname` + random suffix.

### Extend `posts`
- `visibility text default 'public'` — 'public' | 'private' | 'friends'
- `view_count int default 0`
- `like_count int default 0` (denormalized cache; truth still in `post_reactions`)
- `share_count int default 0` (denormalized cache; truth in `post_shares`)
- `save_count int default 0`
- `forward_count int default 0` — friend-to-friend share clicks
- `deleted_at timestamptz` (soft delete so analytics survive)

Update RLS:
- `posts published readable` → replace with:
  - public: `status='published' AND visibility='public' AND deleted_at IS NULL`
  - friends: also accessible if `visibility='friends' AND is_friend(auth.uid(), author_id)`
  - private: only author
  - author always sees own

### New tables
- `follows (follower_id, followee_id uuid, created_at)` PK(follower,followee). Indexes on `(followee_id)`.
- `friendships (requester_id, addressee_id, status text 'pending'|'accepted'|'declined', created_at, responded_at)` PK(requester,addressee). Indexes on `(addressee_id, status)`.
- `saved_posts (user_id, post_id, created_at)` PK. Owner-only RLS.
- `blocks (blocker_id, blocked_id, created_at)` PK. Owner RLS.
- `post_views (id, post_id, viewer_id nullable, session_hash text, viewed_at, country)` — server-fn writes; viewer can't read directly.
- `post_forwards (id, post_id, sender_id, channel text, created_at)` — when user clicks "send to friend".

### Helper functions (security definer)
- `public.is_handle_available(_handle) returns boolean`
- `public.suggest_handles(_base) returns text[]`
- `public.is_friend(_a uuid, _b uuid) returns boolean`
- `public.increment_post_view(_post_id uuid, _session_hash text)` — dedupe per (post,session) within 24h, bumps `posts.view_count`
- Triggers: `posts.like_count/share_count/save_count` auto-bumped via after-insert/delete on `post_reactions`/`post_shares`/`saved_posts`

### Storage
Reuse `story-media` bucket; avatars at `avatars/{user_id}/...`.

## Routes

Public:
- `/u/$handle` — profile (respects privacy + visibility)

Authenticated (`_authenticated/`):
- `/me` → redirects to `/u/{myHandle}`
- `/me/posts` — **post manager** with Published/Drafts/Private tabs
- `/me/posts/$postId` — **post detail + analytics** (sparkline of views over time, like/share/forward breakdown by platform)
- `/me/posts/$postId/edit` — edit title/story/cover/visibility
- `/settings`, `/settings/account|identity|privacy|notifications|language|safety|data`
- `/friends` — incoming/outgoing requests + friends list

## My Posts manager UX

```
┌──────────────────────────────────────────┐
│ Your Posts                  [+ Spill]    │
│ [ Published 12 ] [ Drafts 3 ] [ Private 2 ]│
├──────────────────────────────────────────┤
│ ▢ cover  Title…                          │
│          🚨 742 · 👁 1.2k · ❤️ 89 · 🔁 23 │
│          published 2d ago  ·  public 🌍  │
│          [⋯] menu → Edit · Make private  │
│                       · Copy link · Delete│
└──────────────────────────────────────────┘
```

Bulk actions deferred; per-row menu is enough.

## Post detail analytics page

- Big header: title + cover thumb + score
- KPI row: 👁 views, ❤️ likes, 💬 comments, 🔁 shares, 🔖 saves, 📤 forwards
- Sparkline: views per day (last 30) via aggregate query
- Share breakdown: per-platform bar (x, tiktok, ig, xhs, whatsapp, imessage)
- Top reactions list
- Action bar: Edit · Visibility ▾ · Copy link · Delete

## View tracking implementation

- `/post/$postId` route fires `recordPostView` server fn on mount (debounced, once per session).
- Server fn hashes `userId || (ip+ua)` → `session_hash`, inserts `post_views` if no row for `(post_id, session_hash)` in last 24h, bumps `posts.view_count`.
- Anonymous viewers OK; no PII stored.

## Files (new)

```
src/lib/profile.functions.ts
src/lib/social.functions.ts
src/lib/saved.functions.ts
src/lib/posts-manage.functions.ts   — list mine, update visibility, soft delete, edit, stats
src/lib/post-analytics.functions.ts — KPIs, daily series, share breakdown
src/lib/badges.ts
src/lib/handles.ts

src/routes/u.$handle.tsx
src/routes/_authenticated/me.tsx
src/routes/_authenticated/me/posts.tsx                 — manager (layout + list)
src/routes/_authenticated/me/posts/$postId.tsx         — analytics detail
src/routes/_authenticated/me/posts/$postId.edit.tsx    — edit
src/routes/_authenticated/settings.tsx + 7 children
src/routes/_authenticated/friends.tsx

src/components/profile/ProfileHeader.tsx
src/components/profile/TabBar.tsx
src/components/profile/StoriesGrid.tsx
src/components/profile/ChaosHistory.tsx
src/components/profile/SavedTea.tsx
src/components/profile/BadgesGrid.tsx
src/components/profile/FollowButton.tsx
src/components/profile/FriendButton.tsx
src/components/posts/PostRow.tsx
src/components/posts/PostRowMenu.tsx           — edit / visibility / copy / delete
src/components/posts/VisibilityBadge.tsx
src/components/posts/KpiTile.tsx
src/components/posts/ViewsSparkline.tsx        — pure SVG, no chart lib
src/components/posts/SharePlatformBars.tsx
src/components/identity/HandleEditor.tsx
src/components/identity/AvatarEditor.tsx
src/components/identity/NameShuffler.tsx
```

## Identity rules (unchanged)

- Display name: NOT unique (stored in `profiles.nickname`). Hint format `[City]·[Archetype]`.
- @handle: UNIQUE, lowercase `[a-z0-9_]{3,24}`, debounced live availability + auto-suggestions.
- AI avatar: lazy generate-on-click (rate-limit 5/day per user).
- Anonymous mode toggle hides city/score on public profile + defaults new posts to anonymous.

## Microcopy

- Empty Published: "no chaos posted yet 👀 / either peaceful… or hiding something."
- Delete confirm: "delete forever? the receipts will be wiped 🫥"
- Made private: "this one's just for you now 🔒"
- Handle taken: "@queenchaos is taken (bestie has taste). try one of these:"
- Friend pending: "request sent. now we wait like it's 2009."

## Risks

- Adding `like_count/share_count` triggers needs to backfill from existing rows in same migration.
- Soft-delete posts must be filtered everywhere (feed, profile, search, share preview). Will audit existing queries in the migration commit and patch RLS + any direct selects.
- View dedupe via `session_hash` is best-effort; bots can inflate. Acceptable for v1.
- AI avatar generation cost — rate-limited server-side.

Once you approve I'll: (1) run the migration, (2) build server fns, then (3) routes + components in parallel.
