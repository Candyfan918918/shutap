# Divorce Rank · 婚姻比惨榜 — Build Plan

## Scope reality check (please read)

You picked "Everything in v1" + all 4 AI providers + full localization + moderation/leads/trends. That's a **3–6 month engineering project** at production quality. I will build it, but in **6 sequenced phases** so each is reviewable and deployable. After each phase the app works end-to-end at that level of completeness — you can stop, iterate, or continue.

A few firm constraints upfront:

- **Stack swap**: Next.js 15 → **TanStack Start + React 19 + Vite** (same SSR/server-fn/Postgres/pgvector capabilities). All your URL/i18n/SEO requirements still met.
- **Backend**: Lovable Cloud (Supabase under the hood — Postgres, pgvector, Storage, Auth).
- **AI providers**:
  - **Gemini + GPT** → via Lovable AI Gateway, no keys needed, works day 1.
  - **DeepSeek + ERNIE** → require your API keys. I'll wire stub providers that fall back to Gemini/GPT until you add the keys, so nothing blocks the build.
- **Apple Sign-In**: architected for (provider abstraction), enabled later — Lovable Cloud auth supports email OTP + Google natively.
- **Trend ingestion**: X/Twitter and Reddit APIs require paid keys; I'll ship the ingestion framework + admin UI and use Google Trends + a free news API by default.
- **Legal disclaimer** rendered globally in footer + score result + lead CTA, in current locale.

---

## Phase 1 — Foundation (i18n, design system, auth, schema)

**Goal**: Logged-in user lands on a localized dark "doom-scroll" home with seeded champion-wall cards.

1. **Design system** — dark base, bold display type, oklch tokens in `src/styles.css`; Framer Motion; mobile-first; shadcn/ui themed.
2. **i18n** — locale-prefixed routes `/$lang/...` where `$lang ∈ {en,zh,es,pt,ja,ko}`; detect via cookie → browser → IP (Cloudflare header) → fallback `en`; JSON message catalogs per locale; `useT()` hook; localized SEO `head()` per route.
3. **Lovable Cloud enabled**; auth = email OTP + Google (Apple stubbed behind provider interface).
4. **Auto-nickname system** — `nicknames` table seeded per-locale (200/locale to start); trigger assigns on signup; "Regenerate" button.
5. **DB schema (migrations)** — see Technical Architecture below.
6. **Global legal disclaimer** component + footer.
7. **Homepage v1** — Champion Wall (seeded), CTA section, category chips, trending placeholder. No real stories yet.

**Deliverable**: deployable, multilingual, signed-in users see an emotional home.

---

## Phase 2 — Storytelling core loop

**Goal**: Submit story → AI score → personal result page → appears on leaderboard.

1. **Story composer** — title, body, media upload to Cloud Storage (image/video/carousel), tag picker, location (auto from IP, editable).
2. **AI pipeline** (server functions, one per stage, all written to `story_ai_runs` for replay):
   - **Rewrite & title** — GPT-5-mini (via gateway).
   - **Tag detection + structured extraction** — Gemini 3 Flash structured output → `{betrayal, custody, finance, trauma, in_laws, legal_complexity}` 0–100 each.
   - **Marriage Breakdown Score** — deterministic weighted formula over extracted subscores → 0–1000 + category label; AI generates 1-sentence "verdict".
   - **Embedding** — Gemini embedding → `vector(768)` in pgvector.
   - **Chinese semantic pass** — ERNIE if key present, else Gemini with CN-specific prompt (彩礼/婆媳/冷暴力/房产纠纷 detectors).
   - **DeepSeek** — secondary structured re-scoring if key present (ensemble averaging).
3. **Score reveal screen** — dramatic Framer Motion animation, subscore bars, "more tragic than X% of users" percentile, **share card generator** (canvas → PNG, 3 templates: score / ranking / story preview, optimized 1080×1350 + 1080×1920).
4. **Leaderboards** — materialized views: city / state / country / global × daily/weekly/all-time + category-specific (cheating/custody/finance/in-laws). Server-fn refresh on new score; cron-style refresh every 10 min via `pg_cron`.

**Deliverable**: complete viral loop works.

---

## Phase 3 — Feed + recommendations

**Goal**: TikTok-style vertical feed with real personalization.

1. **Feed UI** — full-screen swipeable cards, video autoplay, like / save / comment / share / "Been through this" / "Worse than mine" / report.
2. **Tabs** — For You · Similar To Me · Near You · Trending · Recovery · Legendary Disasters.
3. **Recommendation engine** (server function `getFeed`):
   - Candidate generation: pgvector kNN on user's emotional embedding (avg of liked + own stories) + geo + trending pool.
   - Scoring: `0.4·cosine_sim + 0.2·behavior_sim + 0.15·geo + 0.15·trending + 0.10·engagement_pred`.
   - Gemini re-rank pass on top 50 → final 20 (uses session signals for retention optimization).
   - Updates user embedding on every meaningful action (like, save, dwell>3s, comment).
4. **Comments** — threaded, AI-moderated on submit.

**Deliverable**: doom-scroll feed feels personalized after a few interactions.

---

## Phase 4 — Moderation + safety

**Goal**: No PII ships, harassment auto-handled.

1. **PII redaction** — regex sweep (phones, emails, addresses, IDs) + Gemini NER pass (names, employers, schools) → masked tokens before publish.
2. **Tri-state classifier** (`safe` / `sensitive` / `dangerous`) — Gemini structured output; dangerous → reject; sensitive → manual queue.
3. **Comment moderation** — same pipeline, sync.
4. **Report flow** + admin queue.

**Deliverable**: every published post is screened; nothing identifying leaks.

---

## Phase 5 — Law firm leads + admin dashboard

**Goal**: Soft monetization + operator tooling.

1. **Lead capture** — triggered when score > 700 OR specific tags (custody/finance/abuse); modal collects optional email/phone/WeChat + case type/urgency; writes to `leads` table.
2. **Admin** (gated by `user_roles.role = 'admin'`):
   - Moderation queue (sensitive / reported).
   - Lead CRM (filter by country/city/case type/urgency, export CSV).
   - Nickname list upload (CSV per locale).
   - Trend manager (see Phase 6).
   - Ranking overrides (pin / unfeature).
   - Analytics: DAU/WAU, retention cohorts, shares per story, leaderboard engagement, story upload rate, lead conversion.

**Deliverable**: you can operate the product.

---

## Phase 6 — Trend ingestion + polish

**Goal**: Daily trending topics drive content, share funnels work everywhere.

1. **Trend ingestion** — server functions hitting Google Trends (free), GDELT/NewsAPI for news, with adapter slots for X & Reddit (activate when keys added). Admin reviews → publishes as "Today's tragic theme" banner with bilingual AI-generated framing.
2. **Deep links + Open Graph** — per-story share URLs with localized OG cards (server-rendered with @vercel/og-equivalent via canvas server fn).
3. **Performance pass** — ISR-style cached leaderboards, image optimization, lazy media, Lighthouse > 90.
4. **Push notifications** — web push opt-in for: someone ranked higher than you, daily trending, your story trending.

**Deliverable**: launch-ready.

---

## Technical Architecture

### Database (Supabase / Postgres + pgvector)

```text
profiles(id pk → auth.users, nickname, locale, country, region, city, created_at)
user_roles(user_id, role enum['admin','moderator','user'])  -- separate table, has_role() SECURITY DEFINER
nicknames(id, locale, text, used_count)
stories(id, author_id, locale, country, region, city,
        title, body_original, body_rewritten, media jsonb,
        tags text[], status enum['draft','published','sensitive','removed'],
        score int, score_category text, subscores jsonb,
        embedding vector(768), created_at, published_at)
story_ai_runs(id, story_id, stage, provider, model, input, output, cost_ms, created_at)
story_interactions(id, user_id, story_id, kind enum['view','like','save','share','been_through','worse','report'], dwell_ms, created_at)
comments(id, story_id, user_id, body, status, created_at)
leaderboards_mv (materialized: scope, scope_id, period, category, story_id, rank, score)
leads(id, user_id, story_id, case_type, urgency, country, city, contact jsonb, status, created_at)
trends(id, source, topic, locale, raw jsonb, ai_framing jsonb, status, scheduled_for)
notifications(id, user_id, kind, payload, read_at, created_at)
```

RLS: stories readable when `status='published'`; writable by author; admin via `has_role()`. Leads readable only by admins. Interactions write-own-only.

### Server functions (`src/lib/*.functions.ts`)

`auth`, `nicknames`, `stories.submit / publish / get / feed`, `ai.score / rewrite / extract / embed / moderate`, `rankings.get / refresh`, `interactions.log`, `comments.*`, `leads.submit / list`, `trends.ingest / publish`, `admin.*`. All AI calls go through one `aiGateway.ts` helper that picks provider per stage with graceful fallback.

### File layout

```text
src/
  routes/
    __root.tsx
    $lang/
      index.tsx               # home (champion wall + CTA + feed preview)
      feed.tsx                # vertical doom-scroll
      story.$id.tsx           # story detail + share OG
      submit.tsx              # composer
      rankings.tsx            # leaderboards browser
      profile.$id.tsx
      login.tsx
      _authenticated/
        me.tsx
        admin/...             # gated by role
    api/public/
      og.$storyId.ts          # OG image server route
      webhooks/...
  lib/
    i18n/                     # detect, messages/{en,zh,es,pt,ja,ko}.json, useT
    ai/                       # gateway, prompts, providers (gemini/gpt/deepseek/ernie)
    *.functions.ts            # server fns
    *.server.ts               # server-only helpers
  components/
    feed/ ranking/ story/ share-card/ ui/
  styles.css
```

### AI provider strategy

Single `pickModel(stage, locale)` resolver:

| Stage | Primary | Fallback |
|---|---|---|
| Rewrite/title | `openai/gpt-5-mini` | `google/gemini-3-flash-preview` |
| Tag + subscore extraction | `google/gemini-3-flash-preview` (structured) | — |
| Embedding | Gemini embedding | — |
| CN nuance | ERNIE (if key) | Gemini w/ CN prompt |
| Ensemble re-score | DeepSeek (if key) | skip |
| Feed re-rank | `google/gemini-3-flash-preview` | — |
| Moderation | `google/gemini-3-flash-preview` structured | — |
| Share-card copy | `openai/gpt-5-mini` | Gemini |

### Localization

Locale catalogs as JSON, type-safe `t('key', vars)`; locale is the first URL segment; all server-fn outputs (titles, summaries, verdicts, nicknames, push copy) generated **in the request locale**; `head()` per route emits localized title/description/og.

### Security & safety

- `user_roles` table + `has_role()` SECURITY DEFINER (per Lovable rules).
- All AI keys server-side only; `LOVABLE_API_KEY` via `process.env` inside handlers.
- Zod validation on every server-fn input with length/format limits.
- PII redaction before insert.
- Disclaimer rendered on home footer, every story page, score reveal, lead modal, in current locale.
- Rate limiting on submit/comment via a Postgres token-bucket function.

---

## What I need from you before Phase 1

1. **Confirm**: proceed with Phase 1 now (foundation + seeded home + auth + i18n + dark design system)? After it deploys you review and we proceed to Phase 2.
2. **DeepSeek + ERNIE keys**: provide later when ready (I'll add stubs now). Confirm OK.
3. **Domain for share cards / deep links**: use the default `*.lovable.app` for now, custom domain later?

When you say "go", I start Phase 1.