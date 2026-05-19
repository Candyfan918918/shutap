# ☕ Spill The Tea™ — Full Composer Rebuild

Transform `/compose` from a one-shot AI draft form into a multi-step **chat-style gossip flow** that ends in a publishable, shareable post with cover media.

## Flow overview

```
/spill (entry)
  → /spill/dump        (story + receipts)
  → /spill/chat        (AI gossip Q&A, dynamic)
  → /spill/receipts    (media nudge)
  → /spill/scanning    (suspense loader)
  → /spill/score       (Chaos Score reveal + rankings)
  → /spill/draft       (3 tone variants, swipeable)
  → /spill/cover       (cover media pick / auto-gen)
  → /spill/preview     (full post preview)
  → /post/$id?shared=0 (publish + viral share popup)
```

State carried across steps via a single `tea_drafts` row (id in URL/session).

## Step-by-step

**0. Entry `/spill`** — Headline "👀 Okay… what ACTUALLY happened?", big CTA "Okay so basically…", secondary "🎙 Tell it out loud", anonymity reassurance.

**1. Dump `/spill/dump`** — Large auto-grow textarea, rotating placeholders, no char limit, autosave every 2s (debounced). Sticky bottom bar: 📱 Drop receipts (image/video/screenshot upload to `story-media`), 🎙 voice input (Web Speech API → transcribe). Single CTA "Spill it →".

**2. Chat `/spill/chat`** — Chat UI (message bubbles, user right / AI left, typing dots). AI streams replies via Lovable AI Gateway (`google/gemini-3-flash-preview`) with system prompt enforcing "validate emotion → funny observation → ONE question". Tool calls extract `{relationship_type, themes[], emotion}` into draft state. Dynamic question renderer supports `text | tap_buttons | multi_select | slider | voice`. Loops 5–15 turns; AI decides when "enough tea", emits `[READY_FOR_SCORE]` sentinel.

**3. Receipts nudge `/spill/receipts`** — Mid-flow card: "Okay wait 👀 Do you have receipts?" → upload UI; skip allowed. If uploaded, AI summarizes contents into draft.

**4. Scanning `/spill/scanning`** — 3–5s animated loader with rotating gossip lines ("Measuring mother-in-law intensity…"). Runs `calculateChaosScore` server fn (extends existing `drama-score.ts` to accept extracted themes/intensities instead of formal scan answers).

**5. Score reveal `/spill/score`** — Reuse `ScoreReveal` component, rebranded headline "🚨 Relationship Chaos Score™", add rankings card (`#X in city / state / worldwide` via `posts` aggregate query), funny commentary tied to band.

**6. Draft `/spill/draft`** — AI generates 3 versions in parallel (Funny / Honest / Extra Petty). Swipeable carousel (mobile) / 3-column grid (desktop). Tap to select, then inline edit title + story.

**7. Cover `/spill/cover`** — Priority: uploaded video → uploaded image → screenshot collage → AI-generated meme card (SVG → PNG via existing `card-svg.ts` + `render-png.server.ts`, with bold "🚨 CHAOS SCORE 742/1000" + pulled quote). Pick or regenerate.

**8. Preview `/spill/preview`** — Full `PostCard` preview with cover, title, summary, score, rankings, tags. Buttons: Edit (back), Save draft, **Publish anonymously**.

**9. Publish → `/post/$id`** — Existing route. Viral share modal opens immediately: "👀 Be honest… is your friend's relationship messier?" with platform buttons (X, TikTok, IG, Xiaohongshu, WhatsApp, iMessage via native share + platform deep links from `share/platforms.ts`).

## Technical changes

**New / changed files**
- `src/routes/spill/index.tsx` (public entry, no auth gate yet)
- `src/routes/_authenticated/spill/dump.tsx`
- `src/routes/_authenticated/spill/chat.$draftId.tsx`
- `src/routes/_authenticated/spill/receipts.$draftId.tsx`
- `src/routes/_authenticated/spill/scanning.$draftId.tsx`
- `src/routes/_authenticated/spill/score.$draftId.tsx`
- `src/routes/_authenticated/spill/draft.$draftId.tsx`
- `src/routes/_authenticated/spill/cover.$draftId.tsx`
- `src/routes/_authenticated/spill/preview.$draftId.tsx`
- `src/components/spill/` — `ChatBubble`, `TypingDots`, `DynamicQuestion`, `ReceiptsUploader`, `ScanningLoader`, `RankingsCard`, `ToneCarousel`, `CoverPicker`, `ShareChallengeModal`
- `src/lib/spill/system-prompt.ts` — gossip persona, tool schemas
- `src/lib/spill.functions.ts` — `createTeaDraft`, `appendChatMessage`, `streamGossipReply` (AI SDK `streamText` with tools), `extractStorySignals`, `computeChaosScore`, `generateThreeTones`, `generateCoverCard`, `publishTea`
- `src/lib/spill/cover-meme.ts` — SVG meme card template
- Extend `src/lib/share/platforms.ts` with TikTok, iMessage, Xiaohongshu deeplinks

**Database** (one migration)
```sql
create table tea_drafts (
  id uuid pk, user_id uuid, status text,
  raw_dump text, transcript text,
  chat_messages jsonb default '[]',
  extracted jsonb default '{}',  -- {relationship_type, themes, emotion, intensity}
  media jsonb default '[]',      -- [{url, kind, blurred_url?}]
  score int, subscores jsonb, category text, chaos_band text,
  rankings jsonb,                 -- {city, state, world}
  draft_variants jsonb,           -- [{tone,title,story}]
  selected_tone text,
  cover_url text, cover_kind text,
  final_post_id uuid,
  created_at, updated_at
);
-- RLS: owner-only CRUD; readable when status='published'
```
Update homepage `☕ Spill The Tea™` card to route `/spill` (not `/compose`).

**AI integration** — Lovable AI Gateway via `@ai-sdk/openai-compatible`; `streamText` from TanStack server fn (generator `async function*`). System prompt enforces persona + one-question rule + emits structured tool calls (`record_signal`, `ready_for_score`). Default model `google/gemini-3-flash-preview`. Three-tone generation uses `generateText` with `Output.object` schema for `[{tone,title,story,hashtags[]}]`.

**Media handling** — Reuse `story-media` bucket. Client uploads → signed URL → store path on `tea_drafts.media`. Optional name-blur is a stretch goal (defer); always show "We hide names" copy.

**Rankings** — Server fn queries `posts` aggregate: `rank() over (partition by city order by score desc)` etc. Cached per draft on score reveal.

**Cover generation** — If no user media: SVG template (gradient by band + big score + pulled quote) → PNG via existing `render-png.server.ts` → upload to `story-media/covers/`.

**Old `/compose`** — Keep route as a redirect to `/spill` for ~1 release; remove after.

## Out of scope (call out, don't build)
- Name auto-blur on screenshots (placeholder copy only)
- Real video transcription pipeline (use Web Speech for now)
- Real-time leaderboard updates (poll on score reveal)
- Native iOS/Android share sheets beyond `navigator.share`
