# Homepage Motion Pass — `src/routes/index.tsx`

Scope is strictly `src/routes/index.tsx` (plus a tiny co-located hook). No new deps, no `framer-motion`/`GSAP`, no edits to `styles.css`.

## What we'll build

1. **Reusable in-view hook** (defined inside `index.tsx`, not a new file): `useInView(ref, options)` — single-fire IntersectionObserver, disconnects after first hit.
2. **Reusable count-up hook**: `useCountUp(target, { duration, start })` driven by `requestAnimationFrame` with `ease-out cubic`. Starts when a passed `enabled` flag flips true (wired to `useInView`).
3. **Single `<style>` block** at the top of `HomePage` containing all keyframes (`fadeUp`, `ghostDrift`, `livePulse`, `cardIn`, `goldGlow`) + the `prefers-reduced-motion` reset as the last rule.

## Section-by-section changes

**Hero**
- Add a ghost watermark div behind the headline using `ghostDrift 14s ease-in-out infinite` (positioned absolute, low opacity, `pointer-events:none`). Note: hero currently has no watermark element; we'll add a decorative `<span aria-hidden>` for this.
- `h1` → `fadeUp 0.6s` on mount.
- Subheading `p` → `fadeUp` with `animation-delay: 0.15s`, initial `opacity:0`.
- CTA wrapper → `fadeUp` delay `0.3s`.
- Verdict counter line → swap `totalVerdicts.toLocaleString()` for `useCountUp(totalVerdicts, { duration: 1800 })` rendered with `.toLocaleString()` each frame.
- **SEO pills**: the current file has no SEO pills section. We will NOT invent one; the staggered-pill animation in the brief is skipped unless the user wants pills added (flagged below).

**Live dot for "In Session Right Now"**
- Current heading has no red dot. Add a small `<span>` dot before the H2 with `livePulse 1.8s ease-in-out infinite` using existing brand red token (we'll use the literal `rgba(212,80,64,…)` per spec).

**Docket cards (live cases)**
- Wrap the `<ul>` with a ref + `useInView` (threshold 0.15).
- Each `<DocketCard>` gets `animation: cardIn 0.45s cubic-bezier(0.22,1,0.36,1) forwards` with `animation-delay: ${i * 0.1}s` once the section is in view (apply via inline style on the `<li>`; initial state `opacity:0; transform:translateY(22px)`).
- Verdict bar: replace the static `width:${pct}%` with a CSS var `--bar-width`. When in view, set `style={{ width: 'var(--bar-width)', transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)', transitionDelay: `${i*0.1 + 0.2}s` }}`; before in-view, width is `0%`.
- Hover: card gets `translateY(-2px)` + soft shadow on hover via Tailwind utilities (no JS).

**HOF band**
- The current file has **no HOF band / stat counters / trophy icon**. We will NOT fabricate one. The HOF-band motion (counters, gold glow, card stagger) is skipped unless the user wants the band added (flagged below).

**Story stream**
- The current file has **no embedded story stream** on `/`. The masonry stagger entrance is skipped unless the user wants a stream block added (flagged below).
- "Read more stories →" button likewise n/a.

**Section reveals**
- Each existing `<section>` (Hero, Docket, How-it-works, Proof, Why-it-exists) gets a ref + `useInView` (threshold 0.1) and toggles a class `in-view` that transitions `opacity 0 → 1` over `0.5s`. Hero is treated as immediately in view to avoid first-paint flash.

**Hover states (Tailwind utility additions only)**
- `DocketCard` `<li>`: `transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]`.
- Primary CTA: `transition-transform duration-150 hover:scale-[1.03]`.
- Ghost CTA: existing `hover:bg-c-surface-2` kept; add `transition-colors duration-150`.

**Outcome block / How-it-works / Why-it-exists**
- Inherit section-level fade-in only; no per-item stagger (out of spec).

## Reduced motion
The `<style>` block ends with:
```css
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```
The count-up hook also short-circuits to the final value when `matchMedia('(prefers-reduced-motion: reduce)').matches`.

## Open questions (please confirm before I build)

The brief references three blocks that don't exist on `/` today: **SEO pills in hero**, the **HOF stat band + cards**, and the **embedded story stream**. Three options:

- **A. Motion-only on what exists** (recommended): apply hero, live-dot, docket cards/bars, hover states, and section reveals. Skip pills/HOF/stream until those sections are actually added.
- **B. I add stub sections** for HOF band and story stream on `/` so the brief's animations have something to attach to (this expands scope beyond pure motion).
- **C. You point me at where those blocks already live** (maybe they were intended for a different route) and I'll apply motion there in a follow-up.

Which would you like?
