# Shutap Step 6: Fill-the-Gaps Plan

The audit found ~40 distinct gaps across 4 surfaces. Shipping everything in one turn would be unsafe (DB schema changes, route → portal refactor, new components, realtime wiring). I'll split into 4 phases so you can review each. **This turn = Phase 1 only.**

---

## Phase 1 — Story Detail + Voting (no schema changes)

Highest-value, lowest-risk. All frontend + reuse of existing `castVerdict`.

1. **VerdictBar upgrade** (`src/components/posts/VerdictBar.tsx`)
   - Add Supabase Realtime subscription (port pattern from `CompactVerdictBar`)
   - Render 7 buttons as 3+3+1 grid
   - Selected state: filled bg + 1px white outline
   - Labels adapt by `relationship_type` (lookup map)
   - Replace toast on anon with SoftGate (`useSoftGate`)
   - Accept `readDepthPercent` prop and pass to `castVerdict`

2. **Scroll-depth tracker** in `post.$postId.tsx`
   - Track max scroll % via scroll listener, feed to VerdictBar

3. **New components** (in `src/components/posts/`)
   - `AliasPill.tsx` — full-size alias + "one-sided / both sides heard" label
   - `JudgmentButtons.tsx` — 2×2 grid (Not Guilty | Guilty | Mixed | Need More Info), local state for now (no DB persistence yet — flagged for Phase 4)
   - `RelateButtonStory.tsx` wrapper around existing `RelateButton` for story detail
   - `SteelmanCard.tsx` — collapsible "The Bench wonders" (gated on `post.has_steelman`, falls back to `null` if field missing)
   - `DevilsAdvocateToggle.tsx` — local toggle that flips verdict context label
   - `CaseSummaryToggle.tsx` — collapsible facts/timeline/players (reads existing post fields, empty-graceful)
   - `SpillScanCTA.tsx` — inline card appearing after vote
   - `AuthorMenu.tsx` — three-dot dropdown for author: Retract / Post update / Close case (links to existing `/me/posts/$postId/*` routes)
   - `ServiceCard.tsx` — qualified-category service nudge

4. **Wire into `post.$postId.tsx`**
   - Add AliasPill above title
   - Render `case_title` + `question_before_court` if present on post (graceful fallback)
   - Mount all new components in spec order
   - Show CTA inline after vote (track local `hasVoted` state)

**Out of scope this phase (documented):**
- `case_title`, `question_before_court`, `has_steelman`, judgment-vote persistence → need migrations (Phase 4)

---

## Phase 2 — Spill Portal Refactor

- Build `src/components/spill/SpillPortal.tsx` (full-screen Dialog + AnimatePresence)
- Convert existing `/spill/$draftId/{chat,draft,score,scoring}` route content into portal step components
- Mount portal from `_authenticated/route.tsx` via a `useSpillStore` trigger
- Keep old routes as thin redirects → open portal
- Add: top progress bar, slide-down question card, alias/anon toggle, cool-down offer, polishing spinner on `ready_to_edit`, guardian success + crisis card

## Phase 3 — Scan Portal Refactor

- Same pattern: `ScanPortal.tsx` + step components
- Fix score color ranges per spec, equal-width "Save privately / Post to feed" buttons, AI 2–3 sentence summary, service card

## Phase 4 — Schema additions

Migrations for:
- `posts.case_title`, `posts.question_before_court`, `posts.has_steelman`, `posts.case_summary` jsonb
- `post_judgment_votes` table (4-option judgment) with weighting + RLS + GRANTs
- `tea_drafts` status `'ready_to_edit'`, `case_title`, `question_before_court` columns
- Privacy phrase flagging in spill chat (server-side PII scrubber wiring)
- Generalisation pill + cross-story warning

---

## What I'll ship this turn

Phase 1 only. No DB changes. ~10 new components + 2 file edits. Story detail will visibly match the spec for everything that doesn't need new columns; the columns-required pieces render gracefully when fields are absent.

Reply **"go"** to start Phase 1, or tell me to re-scope (e.g. "do migrations first" or "skip judgment buttons").
