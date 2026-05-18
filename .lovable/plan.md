# Post Creation & Viral Distribution Engine

A 6-screen flow that fires the moment a user receives their **Marriage Drama Score™**, turning each result into a memeable, shareable story card with one-tap distribution to 8+ platforms.

This is a growth system, not a CMS. Every screen is mobile-first, emotional, and addictive.

---

## 1. UX Flow (6 stages)

```text
[Drama Scan complete]
        │
        ▼
┌──────────────────────────┐
│ 1. Score Reveal          │  (already exists — entry point)
│    742 / 1000            │
│    "Netflix Original™"   │
│   [Turn this into a post]│
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│ 2. AI Draft (auto-gen)   │  spinner: "Writing your story…"
│   Title + Story + Badges │  ~2s
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│ 3. Composer / Preview    │  ← editable
│   Title (tap to edit)    │
│   Score Card Visual      │
│   AI Story (tap to edit) │
│   [+ Add photo/video]    │
│                          │
│  Tone chips:             │
│  [Funny][Serious]        │
│  [Chaotic][Soft]         │
│                          │
│  [Regenerate]            │
│  [Approve & Post]   ←CTA │
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│ 4. Publish               │  status: draft → published
│  - insert into feed      │
│  - assign tags/locale    │
│  - mint /post/{id}       │
│  - render share images   │
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│ 5. Viral Share Popup     │  full-screen, confetti
│  "Ready to go viral"     │
│  ┌──┐┌──┐┌──┐┌──┐        │
│  │X ││XHS││TT││IG│       │
│  ┌──┐┌──┐┌──┐┌──┐        │
│  │FB││iMsg││WA││Copy│    │
│  Preview card image      │
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│ 6. Reaction Loop         │  returns user to /post/{id}
│  live likes/comments     │
│  rank delta badge        │
│  "+12 reactions in 1m"   │
└──────────────────────────┘
```

---

## 2. AI Generation System

**Server function:** `generateStoryDraft` (Lovable AI Gateway, `google/gemini-3-flash-preview` default, GPT/DeepSeek fallback).

Input:
- `score` (0–1000), `category` (Netflix Original™ / Romcom / Sitcom / Indie Drama / Sweet™)
- `subscores` JSON (twist, damage, money, family, comms, love)
- `tags[]`, `locale`, optional `raw_answers`
- `tone`: `funny | serious | chaotic | soft` (default `funny`)
- `regenerate_seed` (rotates wording)

Output (Zod-validated):
```ts
{
  title: string,           // viral hook ≤ 80 chars
  story: string,           // 60–180 chars, memeable
  badges: string[],        // 2–3 (e.g. "Plot Twist: High")
  hashtags: string[],      // 3–5 locale-aware
  platform_captions: {     // pre-formatted, per platform
    x, tiktok, instagram, xiaohongshu, facebook, imessage, whatsapp
  }
}
```

Guardrails: empathy-first, never judgmental, light dark-humor. Strip names, addresses, numbers via PII redaction before model call.

---

## 3. Share Card Image Engine

Server route `POST /api/share-card` — uses `satori` + `resvg-wasm` (edge-safe) to render SVG → PNG.

Three formats per post, rendered on publish and cached in `story-media` bucket:
- `square_1080.png` — IG/X feed
- `vertical_1920.png` — TikTok / IG Story
- `xhs_1242x1660.png` — Xiaohongshu cover

Layout: huge score in tier color, category banner, AI title (text-balance), 2–3 badges, watermark `marriagedrama.app/post/{id}` + QR.

If user uploaded media → composited as background with dark overlay; else gradient based on score tier (legendary/high/mid/low/sweet).

---

## 4. Multi-platform Share Formatter

`buildShareIntent(platform, post)` returns `{ url, text, image }`.

| Platform | Channel | Caption shape |
|---|---|---|
| X | `https://x.com/intent/tweet?...` | hook + score + link + 2 hashtags |
| Facebook | `sharer.php?u=` | link only (FB scrapes OG) |
| WhatsApp | `wa.me/?text=` | one-liner + link |
| iMessage | `sms:&body=` | casual one-liner + link |
| Copy Link | clipboard | `/post/{id}` |
| TikTok | "Save video → open TikTok" modal (no web intent) | caption pre-copied + vertical PNG downloaded |
| Instagram | Same (no web share intent) | square PNG downloaded + caption to clipboard |
| Xiaohongshu | Same (no web intent) | XHS cover PNG + long-form caption to clipboard |

Every caption ends with localized deep-link CTA: **"See your own Marriage Drama Score → marriagedrama.app"** / **"测一下你的婚姻戏剧值"**.

---

## 5. Backend Data Model (migration)

New tables (RLS enforced):

- **`posts`** — `id, story_id (fk stories), author_id, status (draft|published|removed), title, story_text, tone, badges[], hashtags[], media_url, share_card_square, share_card_vertical, share_card_xhs, platform_captions jsonb, locale, score, score_category, created_at, published_at`
- **`post_approvals`** — `id, post_id, user_id, approved_at, version_snapshot jsonb` (audit trail for "user explicitly approved")
- **`post_shares`** — `id, post_id, user_id, platform, shared_at, referrer_clicks int default 0`
- **`post_reactions`** — `id, post_id, user_id, kind (been_there|worse|hug|laugh|drama), created_at`

Extend `stories` with `post_id` back-pointer for the feed-side query.

RLS:
- `posts`: published readable to all; author or admin can update; insert by owner only.
- `post_approvals` / `post_shares`: owner insert + admin read.
- `post_reactions`: any authenticated user insert; everyone reads aggregates via view.

Indexes: `posts(status, published_at desc)`, `post_shares(post_id)`, `post_reactions(post_id, kind)`.

---

## 6. Server functions (`src/lib/posts.functions.ts`)

- `generateStoryDraft({ scoreContext, tone, seed })` — AI draft, no DB write
- `createDraftPost({ storyId, draft })` — insert `posts` row status=`draft`
- `updateDraftPost({ postId, patch })`
- `regenerateCaption({ postId, tone })`
- `approveAndPublish({ postId })` — flips status, inserts `post_approvals`, kicks off `renderShareCards` (awaited), returns `{ url, captions, cards }`
- `recordShare({ postId, platform })`
- `getPostReactions({ postId })` — for the reaction loop polling

All protected with `requireSupabaseAuth` except `getPostReactions` (public, admin-elevated read on published posts).

---

## 7. Frontend components (`src/components/post-engine/`)

- `ScoreRevealCTA.tsx` — "Turn this into a post" button on score screen
- `DraftComposer.tsx` — full preview/edit screen (steps 2–3)
- `ToneSwitcher.tsx` — pill chips, triggers regenerate
- `MediaUploader.tsx` — image/short video to `story-media` bucket
- `ApprovalBar.tsx` — sticky bottom: [Regenerate] [Approve & Post]
- `ViralSharePopup.tsx` — full-screen modal, confetti, 8 platform buttons, preview card
- `PlatformShareButton.tsx` — handles intent vs download-and-copy
- `ReactionPulse.tsx` — live reaction counter on /post/{id}

New route: `src/routes/post.$postId.tsx` — public shareable page with OG/Twitter meta from post data, share card as `og:image`.

---

## 8. Growth loop & deep links

Every share card watermark + every platform caption + every OG image footer includes:
- localized CTA "See your own score"
- short link `marriagedrama.app/s/{postId}` → 302 to `/post/{postId}?ref={platform}`
- `?ref=` increments `post_shares.referrer_clicks` (server route `/api/public/s/$postId`)
- New visitors landing on a post see floating "Get your score" CTA after 5s scroll

```text
User A scans → posts → shares to X
   ↓
User B sees tweet → clicks link → /post/abc?ref=x
   ↓
B reads card → sees CTA → starts own scan
   ↓
B posts → shares → loop
```

---

## 9. Implementation order

1. **DB migration** — `posts`, `post_approvals`, `post_shares`, `post_reactions` + RLS
2. **i18n keys** — composer, tone chips, share popup, captions (en + zh first; es/pt/ja/ko fallback)
3. **Server functions** — draft generation (AI), CRUD, approve+publish, share recording
4. **Share-card renderer** — `satori` + `resvg-wasm` server route, 3 sizes, write to `story-media`
5. **Composer UI** — `DraftComposer` + `ToneSwitcher` + `MediaUploader` + `ApprovalBar`
6. **Viral popup** — `ViralSharePopup` with 8 platform buttons + platform formatter
7. **Public post page** — `/post/$postId` with OG/Twitter meta + reaction loop
8. **Deep link redirect** — `/api/public/s/$postId` with ref tracking
9. **Wire entry point** — "Turn this into a post" button on existing score reveal
10. **Polish** — confetti, framer-motion transitions, haptics on mobile, copy-to-clipboard toasts

---

## Confirm to proceed

I'll start with **steps 1–3** (migration + AI server functions + i18n) in the next turn. Steps 4–10 follow once the data and AI layer are live. The existing homepage stays untouched; this engine plugs into the (still-to-build) score-reveal screen.
