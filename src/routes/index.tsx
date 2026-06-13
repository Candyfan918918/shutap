// Shutap marketing homepage. SSR via loader → server fn.
// Visual reference: the uploaded shutap-landing.html, ported to project tokens.
// All interactive controls route to /enter (sign-in).
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  getHomepageData,
  type LiveCase,
  type HofEntry,
  type HofStats,
  type StreamStory,
} from "@/lib/marketing/homepage.functions";
import { headHome } from "@/lib/seo/meta";

const SIGN_IN = "/enter" as const;

export const Route = createFileRoute("/")({
  loader: () => getHomepageData(),
  component: HomePage,
  head: ({ loaderData }) => headHome(loaderData?.totalVerdicts),
  errorComponent: ({ error }) => (
    <main className="min-h-screen bg-c-surface text-c-text-1 grid place-items-center px-6">
      <p className="text-sm text-c-text-2 max-w-md text-center">The bench is unavailable. {error.message}</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="min-h-screen bg-c-surface text-c-text-1 grid place-items-center px-6">
      <p className="text-sm text-c-text-2">This case doesn't exist.</p>
    </main>
  ),
});

// ── Motion helpers ─────────────────────────────────────────────────────────

function useInView<T extends Element>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      options,
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, inView] as const;
}

function useCountUp(target: number, duration = 1800, enabled = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target); return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);
  return value;
}

// Ticks remaining time until an ISO timestamp. Falls back to a steady 1h 44m if no target.
function useCountdown(targetIso: string | null | undefined): string {
  const compute = () => {
    if (!targetIso) return "1:44:07";
    const ms = new Date(targetIso).getTime() - Date.now();
    if (Number.isNaN(ms)) return "1:44:07";
    if (ms <= 0) return "0:00:00";
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };
  const [label, setLabel] = useState(compute);
  useEffect(() => {
    setLabel(compute());
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setLabel(compute()), 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIso]);
  return label;
}

function formatRemaining(iso: string | null | undefined): string {
  if (!iso) return "closing soon";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "closing soon";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d remaining`;
  if (h >= 1) return `${h}h ${m}m remaining`;
  return `${Math.max(1, m)}m remaining`;
}

// ── Page ───────────────────────────────────────────────────────────────────

function HomePage() {
  const { totalVerdicts, liveCases, hofStats, hofEntries, streamStories } =
    Route.useLoaderData() as import("@/lib/marketing/homepage.functions").HomepageData;

  const navigate = useNavigate();
  const goSignIn = () => navigate({ to: SIGN_IN });

  const animatedVerdicts = useCountUp(totalVerdicts || 2_847_291, 2200, true);

  const [courtRef, courtIn] = useInView<HTMLElement>({ threshold: 0.1 });
  const [caseRef, caseIn] = useInView<HTMLDivElement>({ threshold: 0.15 });
  const [docketRef, docketIn] = useInView<HTMLDivElement>({ threshold: 0.1 });
  const [hofRef, hofIn] = useInView<HTMLElement>({ threshold: 0.2 });
  const [streamRef, streamIn] = useInView<HTMLDivElement>({ threshold: 0.05 });
  const [seoRef, seoIn] = useInView<HTMLElement>({ threshold: 0.1 });

  const verdictsWeek = useCountUp(hofStats?.verdictsThisWeek ?? 18_432, 1400, hofIn);
  const casesDecided = useCountUp(hofStats?.casesDecided ?? 1_204, 1400, hofIn);
  const unanimousPct = useCountUp(hofStats?.unanimousPct ?? 23, 1400, hofIn);

  const featured = liveCases?.[0] ?? null;
  const featuredCountdown = useCountdown(featured?.closesAt ?? null);
  const featuredTitle =
    featured?.title ??
    "I refused to attend my brother's wedding after he made my abuser the best man without telling me";
  const featuredBadge = featured?.courtBadge ?? "Family Court · World tier";

  return (
    <div className="min-h-screen bg-c-surface text-c-text-1" style={{ fontFamily: "var(--font-body)" }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ghostDrift {
          0%{transform:translate(-50%,-50%) scale(1) rotate(0)}
          33%{transform:translate(-51%,-49%) scale(1.02) rotate(.5deg)}
          66%{transform:translate(-49%,-51%) scale(.98) rotate(-.4deg)}
          100%{transform:translate(-50%,-50%) scale(1) rotate(0)}
        }
        @keyframes livePulse {
          0%,100%{box-shadow:0 0 0 0 rgba(212,80,64,.55)}
          60%{box-shadow:0 0 0 6px rgba(212,80,64,0)}
        }
        @keyframes goldGlow { 0%,100%{color:#c8960a} 50%{color:#f0b830} }
        @keyframes pillIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes seatIn { from{opacity:0;transform:scale(.6)} to{opacity:1;transform:scale(1)} }

        .anim-fadeup   { opacity:0; animation: fadeUp .65s ease .08s forwards; }
        .anim-fadeup-1 { opacity:0; animation: fadeUp .65s ease .22s forwards; }
        .anim-fadeup-2 { opacity:0; animation: fadeUp .65s ease .38s forwards; }
        .anim-fadeup-3 { opacity:0; animation: fadeUp .5s ease .95s forwards; }

        .ghost-text {
          position:absolute; top:50%; left:50%;
          font-family: var(--font-display);
          font-weight:700; letter-spacing:.14em;
          white-space:nowrap; pointer-events:none; user-select:none;
          animation: ghostDrift 15s ease-in-out infinite;
        }
        .ghost-hero    { font-size: clamp(72px, 14vw, 140px); color: rgba(136,0,64,.045); }
        .ghost-ribbon  { font-size: clamp(72px, 14vw, 130px); color: rgba(255,208,232,.55); letter-spacing:.10em; }
        .ghost-case    { font-size: clamp(56px, 9vw, 90px);   color: rgba(136,0,64,.04);  letter-spacing:.08em; }

        .live-dot {
          width:7px; height:7px; border-radius:50%;
          background:#d45040; display:inline-block; flex-shrink:0;
          animation: livePulse 1.9s ease-in-out infinite;
        }
        .gold-trophy { animation: goldGlow 3s ease-in-out infinite; }

        .pill-kw {
          background: rgba(136,0,64,.08);
          color: var(--c-pink-ink);
          font-size:11px; padding:4px 13px; border-radius:12px;
          opacity:0; animation: pillIn .4s ease forwards;
          transition: background .15s;
        }
        .pill-kw:hover { background: rgba(136,0,64,.16); }

        .section-reveal { opacity:0; transform:translateY(20px); transition:opacity .5s ease, transform .5s cubic-bezier(.22,1,.36,1); }
        .section-reveal.in-view { opacity:1; transform:translateY(0); }

        /* Verdict bar segments animate from 0 to data-w on reveal */
        .vb-seg { height:100%; width:0; transition: width 1.2s cubic-bezier(.22,1,.36,1); }
        .section-reveal.in-view .vb-seg[data-w] { width: attr(data-w %); }

        /* Docket card bars + HOF card stagger */
        .docket-card { opacity:0; transform:translateY(20px); transition: transform .2s ease, box-shadow .2s ease, border-color .2s; }
        .docket-grid.in-view .docket-card { opacity:1; transform:translateY(0); transition-delay: var(--d, 0s); }
        .docket-card:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(0,0,0,.09); }
        .docket-bar { width:0; transition: width 1s cubic-bezier(.22,1,.36,1); }
        .docket-grid.in-view .docket-bar { width: var(--w); }

        .hof-card { opacity:0; transform:translateY(20px); transition: opacity .45s ease, transform .45s cubic-bezier(.22,1,.36,1), border-color .2s, background .2s; }
        .hof-grid.in-view .hof-card { opacity:1; transform:translateY(0); transition-delay: var(--d, 0s); }
        .hof-card:hover { border-color: rgba(200,150,10,.55); background: rgba(200,150,10,.12); }

        .stream-card { opacity:0; transform:translateY(28px); transition: opacity .5s ease, transform .5s cubic-bezier(.22,1,.36,1), box-shadow .2s; }
        .stream-grid.in-view .stream-card { opacity:1; transform:translateY(0); transition-delay: var(--d, 0s); }
        .stream-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.09); }
        .stream-bar { width:0; transition: width 1s cubic-bezier(.22,1,.36,1); }
        .stream-grid.in-view .stream-bar { width: var(--w); }

        /* Jury seats */
        .seats-grid { display:grid; grid-template-columns: repeat(6, 1fr); gap:7px; }
        .seat { aspect-ratio:1; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:18px; }
        .seat-filled { background: rgba(255,255,255,.08); border: .5px solid rgba(255,255,255,.1); opacity:0; }
        .section-reveal.in-view .seat-filled { animation: seatIn .35s ease forwards; animation-delay: var(--d, 0s); }
        .seat-empty { background: rgba(255,255,255,.03); border: .5px dashed rgba(255,255,255,.07); }

        /* Masonry stream */
        .masonry { columns: 3; column-gap: 11px; }
        .masonry > * { break-inside: avoid; margin-bottom: 11px; }
        @media (max-width: 900px) { .masonry { columns: 2; } }
        @media (max-width: 560px) { .masonry { columns: 1; } }

        .vbtn, .jbtn { transition: background .15s, border-color .15s, transform .15s; }
        .vbtn:hover, .jbtn:hover { background: var(--c-surface-3); transform: translateY(-1px); }
        .vbtn.sel, .jbtn.sel { background: rgba(136,0,64,.09); border-color: rgba(136,0,64,.32); }

        .submit-cta { transition: opacity .2s, transform .15s, background .2s; }
        .submit-cta:hover { opacity:.88; transform: translateY(-1px); }

        .cta-primary { transition: transform .18s ease; }
        .cta-primary:hover { transform: scale(1.04); }
        .cta-ghost { transition: background-color .18s ease; }
        .cta-ghost:hover { background: rgba(136,0,64,.06); }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation: none !important; transition: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>

      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-7 py-3 border-b border-c-border bg-c-surface">
        <Link to="/" className="text-base font-semibold tracking-[.06em] text-c-text-1">SHUTAP</Link>
        <div className="flex items-center gap-5">
          <a href="#court" className="hidden sm:inline text-xs text-c-text-2 hover:text-c-text-1">Court</a>
          <a href="#stream" className="hidden sm:inline text-xs text-c-text-2 hover:text-c-text-1">Stream</a>
          <a href="#hof" className="hidden sm:inline text-xs text-c-text-2 hover:text-c-text-1">Hall of Fame</a>
          <Link
            to={SIGN_IN}
            className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
            style={{ background: "var(--c-pink-ink)" }}
          >
            Spill it
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section
        className="relative overflow-hidden border-b border-c-border px-7 text-center"
        style={{ background: "var(--c-surface-2)", paddingTop: 56, paddingBottom: 42 }}
      >
        <span aria-hidden className="ghost-text ghost-hero">SHUTAP</span>
        <h1
          className="anim-fadeup relative font-normal text-c-text-1"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px,5vw,40px)", lineHeight: 1.18, marginBottom: 12 }}
        >
          Spill it.<br />The court decides.
        </h1>
        <p className="anim-fadeup-1 relative mx-auto text-c-text-2" style={{ fontSize: 14, maxWidth: 380, lineHeight: 1.68, marginBottom: 24 }}>
          Share your story. Get a real verdict from real people. Am I wrong? The crowd will judge.
        </p>
        <div className="anim-fadeup-2 relative flex flex-wrap justify-center gap-3">
          <Link
            to={SIGN_IN}
            className="cta-primary inline-flex items-center rounded-full text-white"
            style={{ background: "var(--c-pink-ink)", padding: "11px 26px", fontSize: 13, fontWeight: 500 }}
          >
            Open a case
          </Link>
          <Link
            to={SIGN_IN}
            className="cta-ghost inline-flex items-center rounded-full"
            style={{
              border: "0.5px solid var(--c-pink-ink)",
              color: "var(--c-pink-ink)",
              padding: "11px 26px",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Enter the court
          </Link>
        </div>
        <div className="relative mt-5 flex flex-wrap justify-center gap-2">
          {["Am I wrong?", "AITA alternative", "relationship verdict", "crowd judgment", "life decisions", "am I the asshole?", "get a verdict"].map((kw, i) => (
            <button
              key={kw}
              type="button"
              onClick={goSignIn}
              className="pill-kw"
              style={{ animationDelay: `${0.52 + i * 0.07}s` }}
            >
              {kw}
            </button>
          ))}
        </div>
        <p className="anim-fadeup-3 relative mt-4 text-c-text-3 tabular-nums" style={{ fontSize: 11 }}>
          Over <strong className="text-c-text-2">{animatedVerdicts.toLocaleString()}</strong> verdicts delivered
        </p>
      </section>

      {/* COURT RIBBON */}
      <span id="court" />
      <section
        ref={courtRef}
        className={`section-reveal relative overflow-hidden border-b border-c-border px-7 text-center ${courtIn ? "in-view" : ""}`}
        style={{ background: "var(--c-surface-2)", paddingTop: 30, paddingBottom: 24, borderTop: "0.5px solid var(--c-border)" }}
      >
        <span aria-hidden className="ghost-text ghost-ribbon">COURT</span>
        <div className="relative text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--c-pink-ink)", marginBottom: 7 }}>
          Relationship Court™ · Where the human decides
        </div>
        <h2 className="relative" style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 5 }}>
          The cases the algorithm couldn't ignore.
        </h2>
        <p className="relative italic text-c-text-2" style={{ fontSize: 12, marginBottom: 16 }}>
          "What would you do if you were her?"
        </p>
        <div
          className="relative inline-flex items-center gap-2 rounded-full bg-c-surface px-3.5 py-1.5"
          style={{ border: "0.5px solid rgba(136,0,64,.2)", color: "var(--c-pink-ink)", fontSize: 11 }}
        >
          <span className="live-dot" /> {liveCases.length || 3} cases in session · 12,847 jurors active
        </div>
      </section>

      {/* FEATURED LIVE CASE */}
      <div ref={caseRef} className={`section-reveal border-b border-c-border ${caseIn ? "in-view" : ""}`} style={{ padding: "20px 28px 24px" }}>
        {/* Case hero card */}
        <article className="relative overflow-hidden rounded-[14px]" style={{ background: "var(--c-surface-2)", border: "0.5px solid var(--c-border)", padding: "20px 22px 18px", marginBottom: 18 }}>
          <span aria-hidden className="ghost-text ghost-case">CASE #4F2A</span>
          <div className="relative text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--c-pink-ink)", marginBottom: 9 }}>
            Case · {featuredBadge}
          </div>
          <h3 className="relative" style={{ fontFamily: "var(--font-display)", fontSize: 17, lineHeight: 1.38, marginBottom: 7 }}>
            "{featuredTitle}"
          </h3>
          <p className="relative italic text-c-text-2" style={{ fontSize: 12, marginBottom: 14 }}>
            Does loyalty to family end where your own safety begins?
          </p>
          <div className="relative inline-flex items-center gap-2 rounded-md bg-c-surface" style={{ border: "0.5px solid var(--c-border)", padding: "5px 11px", fontSize: 11, color: "var(--c-text-2)" }}>
            ⏱ <strong className="text-c-text-1 tabular-nums">{featuredCountdown}</strong> until verdict locks
          </div>
        </article>

        {/* Parties */}
        <div className="grid gap-3 sm:grid-cols-[1fr_34px_1fr]" style={{ marginBottom: 18 }}>
          <Party
            emoji="😤"
            role="Plaintiff"
            name="The Absent Sister"
            statusLabel="Testimony filed"
            statusTone="present"
            quote={`"He knew exactly what he was doing when he made that choice. I had absolutely no warning."`}
          />
          <div className="hidden sm:flex items-center justify-center">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full" style={{ background: "rgba(136,0,64,.08)", border: "0.5px solid rgba(136,0,64,.15)", color: "var(--c-pink-ink)", fontSize: 11, fontWeight: 600 }}>
              vs
            </span>
          </div>
          <Party
            emoji="👻"
            role="Defendant"
            name="The Brother"
            statusLabel="No response yet"
            statusTone="absent"
            quote="The other chair is empty. The court proceeds regardless."
            quoteMuted
          />
        </div>

        {/* Live verdict bar */}
        <div style={{ marginBottom: 18 }}>
          <div className="text-[10px] uppercase tracking-[0.1em] text-c-text-2" style={{ marginBottom: 9 }}>
            Live verdict — 8,214 votes cast
          </div>
          <div className="flex overflow-hidden rounded-[5px]" style={{ height: 9, background: "rgba(10,8,15,.07)", gap: 1 }}>
            <VbSeg color="var(--c-green-flag)" pct={61} active={caseIn} delay={0.2} />
            <VbSeg color="var(--c-purple)"     pct={18} active={caseIn} delay={0.3} />
            <VbSeg color="var(--c-amber)"      pct={12} active={caseIn} delay={0.4} />
            <VbSeg color="var(--c-pink-ink)"   pct={9}  active={caseIn} delay={0.5} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-c-text-2" style={{ fontSize: 11 }}>
            <Legend color="var(--c-green-flag)" label="NTA — 61%" />
            <Legend color="var(--c-purple)"     label="Everyone sucks — 18%" />
            <Legend color="var(--c-amber)"      label="Need more info — 12%" />
            <Legend color="var(--c-pink-ink)"   label="YTA — 9%" />
          </div>
        </div>

        {/* Jury — dark */}
        <div className="rounded-[13px]" style={{ background: "#0a080f", padding: 16, marginBottom: 18 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 13 }}>
            <span className="uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,.45)", fontSize: 11 }}>
              ⚖️ The Bench · Hon. Public Opinion
            </span>
            <span style={{ color: "#c8960a", fontSize: 11 }}>8,214 seated</span>
          </div>
          <div className="seats-grid" style={{ marginBottom: 10 }}>
            {["😤","🧑","👩","🧔","👱","🧕","👨","🧑‍🦱","👩‍🦰","🧓"].map((e, i) => (
              <div key={i} className="seat seat-filled" style={{ ["--d" as any]: `${i * 0.07}s` }}>{e}</div>
            ))}
            <div className="seat seat-empty" />
            <div className="seat seat-empty" />
          </div>
          <div className="italic" style={{ color: "rgba(255,255,255,.28)", fontSize: 10 }}>
            3 new jurors seated in the last minute · debate ongoing in the gallery
          </div>
        </div>

        {/* Vote grid */}
        <VoteGrid onPick={goSignIn} />

        <button
          type="button"
          onClick={goSignIn}
          className="vbtn w-full rounded-[11px]"
          style={{ background: "var(--c-surface-2)", border: "0.5px solid var(--c-border)", padding: 11, fontSize: 12, color: "var(--c-text-2)", marginBottom: 18, fontFamily: "var(--font-body)" }}
        >
          🔔 Need an update from the other side first
        </button>

        {/* Final judgment grid */}
        <div style={{ marginBottom: 18 }}>
          <div className="text-[10px] uppercase tracking-[0.1em] text-c-text-2" style={{ marginBottom: 9 }}>Final judgment</div>
          <div className="grid grid-cols-4 gap-2.5">
            {[
              { e: "😈", l: "Guilty" },
              { e: "😇", l: "Not guilty" },
              { e: "🤝", l: "Both at fault" },
              { e: "🔍", l: "More info" },
            ].map((j) => (
              <button
                key={j.l}
                type="button"
                onClick={goSignIn}
                className="jbtn rounded-[11px] text-center"
                style={{ background: "var(--c-surface-2)", border: "0.5px solid var(--c-border)", padding: "11px 6px", fontFamily: "var(--font-body)" }}
              >
                <span className="block" style={{ fontSize: 20, marginBottom: 4 }}>{j.e}</span>
                <span className="block text-c-text-1" style={{ fontSize: 10, fontWeight: 500 }}>{j.l}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={goSignIn}
          className="submit-cta w-full rounded-[11px] text-white"
          style={{ background: "var(--c-pink-ink)", padding: 14, fontSize: 13, fontWeight: 500, fontFamily: "var(--font-body)", border: "none", cursor: "pointer" }}
        >
          Cast your verdict to join the court
        </button>
        <div className="text-center text-c-text-3" style={{ fontSize: 10, marginTop: 9 }}>
          Zero real names. Ever. · Your vote is anonymous.
        </div>
      </div>

      {/* ALSO IN SESSION (docket) */}
      <div className="flex items-center justify-between" style={{ padding: "18px 28px 12px" }}>
        <span className="flex items-center gap-2 uppercase tracking-[0.09em] text-c-text-2" style={{ fontSize: 11, fontWeight: 500 }}>
          <span className="live-dot" /> Also in session
        </span>
        <button type="button" onClick={goSignIn} className="text-xs" style={{ color: "var(--c-pink-ink)" }}>Full court →</button>
      </div>
      <div
        ref={docketRef}
        className={`docket-grid grid gap-3 sm:grid-cols-3 ${docketIn ? "in-view" : ""}`}
        style={{ padding: "0 28px 24px" }}
      >
        {(liveCases.length > 1 ? liveCases.slice(1, 7) : []).map((c, i) => (
          <DocketCard key={c.caseId} c={c} index={i} onClick={goSignIn} />
        ))}
        {liveCases.length <= 1 && FALLBACK_DOCKET.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={goSignIn}
            className="docket-card rounded-[13px] p-3.5 text-left"
            style={{ background: "var(--c-surface-2)", border: "0.5px solid var(--c-border)", ["--d" as any]: `${i * 0.07}s` }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 9 }}>
              <span className="flex items-center gap-1" style={{ fontSize: 10, color: "var(--c-coral)", fontWeight: 500 }}>
                <span className="live-dot" /> Live
              </span>
              <span className="rounded-[10px] px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, color: c.catColor, background: c.catBg }}>{c.cat}</span>
            </div>
            <h4 className="text-c-text-1" style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.42, marginBottom: 9, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.title}</h4>
            <div className="flex overflow-hidden rounded-[2px]" style={{ height: 4, background: "rgba(10,8,15,.08)", marginBottom: 6 }}>
              <div className="docket-bar" style={{ background: "var(--c-green-flag)", ["--w" as any]: `${c.g}%` }} />
              <div className="docket-bar" style={{ background: "var(--c-pink-ink)", ["--w" as any]: `${c.r}%` }} />
            </div>
            <div className="flex justify-between" style={{ fontSize: 10 }}>
              <span style={{ color: "var(--c-green-flag)", fontWeight: 500 }}>{c.g}% NTA</span>
              <span className="text-c-text-3">{c.votes.toLocaleString()} votes</span>
              <span style={{ color: "var(--c-pink-ink)", fontWeight: 500 }}>{c.r}% YTA</span>
            </div>
            <div className="text-c-text-3" style={{ fontSize: 10, marginTop: 5 }}>⏱ {c.remaining}</div>
          </button>
        ))}
      </div>

      {/* HALL OF FAME — dark */}
      <span id="hof" />
      <section
        ref={hofRef}
        className={`section-reveal ${hofIn ? "in-view" : ""}`}
        style={{ background: "#0a080f", padding: "26px 28px 28px", borderTop: "0.5px solid rgba(255,255,255,.06)", borderBottom: "0.5px solid rgba(255,255,255,.06)" }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
          <span className="flex items-center gap-2 uppercase tracking-[0.1em]" style={{ color: "#c8960a", fontSize: 11, fontWeight: 500 }}>
            <span className="gold-trophy" style={{ fontSize: 15 }}>🏆</span> Hall of Fame
          </span>
          <button type="button" onClick={goSignIn} className="text-xs" style={{ color: "rgba(255,255,255,.32)" }}>Full HOF →</button>
        </div>
        <div className="grid grid-cols-3 gap-3" style={{ marginBottom: 18 }}>
          <HofStat n={verdictsWeek.toLocaleString()} l="verdicts this week" />
          <HofStat n={casesDecided.toLocaleString()} l="cases decided" />
          <HofStat n={`${unanimousPct}%`} l="unanimous this month" />
        </div>
        <div className={`hof-grid grid gap-3 sm:grid-cols-3 ${hofIn ? "in-view" : ""}`}>
          {(hofEntries.length > 0 ? hofEntries : FALLBACK_HOF).map((h, i) => (
            <button
              key={`${i}:${"entityId" in h ? h.entityId : h.title}`}
              type="button"
              onClick={goSignIn}
              className="hof-card rounded-[13px] p-3.5 text-left"
              style={{
                background: "rgba(200,150,10,.07)",
                border: "0.5px solid rgba(200,150,10,.2)",
                ["--d" as any]: `${i * 0.12}s`,
              }}
            >
              <div style={{ color: "#c8960a", fontSize: 10, fontWeight: 500, marginBottom: 5 }}>#{i + 1} This Week</div>
              <h4 style={{ color: "rgba(255,255,255,.82)", fontSize: 12, fontWeight: 500, lineHeight: 1.42, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                "{("title" in h ? h.title : "")}"
              </h4>
              <div style={{ color: "rgba(255,255,255,.35)", fontSize: 10 }}>
                Verdict: <strong style={{ color: "var(--c-green-flag)" }}>{"verdictPct" in (h as any) ? `${(h as any).verdictPct}% NTA` : (h as any).verdictLabel ?? "Honored"}</strong> · {"votes" in (h as any) ? (h as any).votes : `${("score" in (h as any) ? (h as any).score.toLocaleString() : "—")} pts`}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* STREAM — masonry */}
      <span id="stream" />
      <div className="flex items-center justify-between" style={{ padding: "18px 28px 12px" }}>
        <span className="uppercase tracking-[0.09em] text-c-text-2" style={{ fontSize: 11, fontWeight: 500 }}>Latest from the stream</span>
        <button type="button" onClick={goSignIn} className="text-xs" style={{ color: "var(--c-pink-ink)" }}>See all →</button>
      </div>
      <div
        ref={streamRef}
        className={`stream-grid ${streamIn ? "in-view" : ""}`}
        style={{ padding: "0 20px 24px" }}
      >
        <div className="masonry">
          {(streamStories.length > 0 ? streamStories.map(streamToCard) : FALLBACK_STREAM).map((s, i) => (
            <StreamCard key={i} s={s} index={i} onClick={goSignIn} />
          ))}
        </div>
        <div className="text-center" style={{ padding: "8px 0 4px" }}>
          <button
            type="button"
            onClick={goSignIn}
            className="cta-ghost rounded-full"
            style={{ background: "transparent", color: "var(--c-pink-ink)", border: "0.5px solid rgba(136,0,64,.3)", padding: "10px 28px", fontSize: 13, fontFamily: "var(--font-body)", cursor: "pointer" }}
          >
            Read more stories →
          </button>
        </div>
      </div>

      {/* SEO */}
      <section
        ref={seoRef}
        className={`section-reveal text-center ${seoIn ? "in-view" : ""}`}
        style={{ background: "var(--c-surface-2)", borderTop: "0.5px solid var(--c-border)", padding: "32px 28px 36px" }}
      >
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, marginBottom: 12, lineHeight: 1.3 }}>
          The internet's relationship court, powered by real people
        </h2>
        <p className="mx-auto text-c-text-2" style={{ fontSize: 13, lineHeight: 1.78, maxWidth: 520, marginBottom: 10 }}>
          Shutap is where you go when you need an honest verdict. Share your story — relationship drama, family conflict, workplace tension, stranger moments — and let thousands of real people weigh in. Not an algorithm. Not advice. A verdict.
        </p>
        <p className="mx-auto text-c-text-2" style={{ fontSize: 13, lineHeight: 1.78, maxWidth: 520, marginBottom: 10 }}>
          Whether you're asking am I wrong, AITA, or just need outside perspective on a tough life decision — Shutap's crowd jury gives you a real answer. Join over <strong>{animatedVerdicts.toLocaleString()}</strong> verdicts and counting.
        </p>
        <p className="italic text-c-text-3" style={{ fontSize: 12, marginTop: 14 }}>
          In an AI world, stay human. Every verdict here is cast by a real person.
        </p>
      </section>

      {/* FOOTER */}
      <footer className="flex items-center justify-between border-t border-c-border text-c-text-3" style={{ padding: "14px 28px", fontSize: 11 }}>
        <span>© 2025 Shutap</span>
        <span>About · Privacy · Terms</span>
      </footer>
    </div>
  );
}

// ── Pieces ─────────────────────────────────────────────────────────────────

function Party({
  emoji, role, name, statusLabel, statusTone, quote, quoteMuted,
}: {
  emoji: string; role: string; name: string;
  statusLabel: string; statusTone: "present" | "absent";
  quote: string; quoteMuted?: boolean;
}) {
  return (
    <div className="rounded-[13px]" style={{ background: "var(--c-surface-2)", border: "0.5px solid var(--c-border)", padding: 16 }}>
      <div style={{ fontSize: 30, marginBottom: 7 }}>{emoji}</div>
      <div className="uppercase tracking-[0.1em] text-c-text-3" style={{ fontSize: 10, marginBottom: 3 }}>{role}</div>
      <div className="text-c-text-1" style={{ fontSize: 13, fontWeight: 500, marginBottom: 5 }}>{name}</div>
      <span
        className="inline-block rounded-[8px] px-2 py-0.5"
        style={{
          fontSize: 10,
          marginBottom: 9,
          color: statusTone === "present" ? "var(--c-green-flag)" : "var(--c-text-3)",
          background: statusTone === "present" ? "rgba(26,158,130,.1)" : "rgba(10,8,15,.05)",
        }}
      >
        {statusLabel}
      </span>
      <p className="italic" style={{ fontSize: 11.5, lineHeight: 1.55, color: quoteMuted ? "var(--c-text-3)" : "var(--c-text-2)" }}>
        {quote}
      </p>
    </div>
  );
}

function VbSeg({ color, pct, active, delay }: { color: string; pct: number; active: boolean; delay: number }) {
  return (
    <div
      className="vb-seg rounded-[2px]"
      style={{ background: color, width: active ? `${pct}%` : 0, transitionDelay: `${delay}s` }}
      data-w={pct}
    />
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="rounded-full" style={{ width: 8, height: 8, background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

function VoteGrid({ onPick }: { onPick: () => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const items = [
    { e: "😇", l: "NTA",  p: "61%" },
    { e: "😈", l: "YTA",  p: "9%"  },
    { e: "🤝", l: "ESH",  p: "18%" },
    { e: "🔍", l: "Need more info", p: "12%" },
    { e: "💔", l: "Lose-lose", p: "—" },
    { e: "⚡", l: "It's complicated", p: "—" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2.5" style={{ marginBottom: 9 }}>
      {items.map((v) => (
        <button
          key={v.l}
          type="button"
          onClick={() => { setSel(v.l); onPick(); }}
          className={`vbtn rounded-[11px] text-center ${sel === v.l ? "sel" : ""}`}
          style={{ background: "var(--c-surface-2)", border: "0.5px solid var(--c-border)", padding: "11px 8px", fontFamily: "var(--font-body)" }}
        >
          <span className="block" style={{ fontSize: 22, marginBottom: 5 }}>{v.e}</span>
          <span className="block text-c-text-1" style={{ fontSize: 10, fontWeight: 500, marginBottom: 2 }}>{v.l}</span>
          <span className="block text-c-text-2" style={{ fontSize: 10 }}>{v.p}</span>
        </button>
      ))}
    </div>
  );
}

function HofStat({ n, l }: { n: string; l: string }) {
  return (
    <div className="rounded-[10px] text-center" style={{ background: "rgba(255,255,255,.05)", border: "0.5px solid rgba(255,255,255,.06)", padding: 12 }}>
      <div style={{ fontSize: 22, fontWeight: 500, color: "#c8960a" }} className="tabular-nums">{n}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)", marginTop: 3 }}>{l}</div>
    </div>
  );
}

function DocketCard({ c, index, onClick }: { c: LiveCase; index: number; onClick: () => void }) {
  const g = Math.max(4, c.topVerdictPct || 50);
  const r = Math.max(4, 100 - g);
  const cat = catFor(c.courtBadge);
  return (
    <button
      type="button"
      onClick={onClick}
      className="docket-card rounded-[13px] p-3.5 text-left"
      style={{ background: "var(--c-surface-2)", border: "0.5px solid var(--c-border)", ["--d" as any]: `${index * 0.07}s` }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 9 }}>
        <span className="flex items-center gap-1" style={{ fontSize: 10, color: "var(--c-coral)", fontWeight: 500 }}>
          <span className="live-dot" /> Live
        </span>
        <span className="rounded-[10px] px-2 py-0.5" style={{ fontSize: 10, fontWeight: 500, color: cat.color, background: cat.bg }}>
          {cat.label}
        </span>
      </div>
      <h4 className="text-c-text-1" style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.42, marginBottom: 9, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.title}</h4>
      <div className="flex overflow-hidden rounded-[2px]" style={{ height: 4, background: "rgba(10,8,15,.08)", marginBottom: 6 }}>
        <div className="docket-bar" style={{ background: "var(--c-green-flag)", ["--w" as any]: `${g}%` }} />
        <div className="docket-bar" style={{ background: "var(--c-pink-ink)", ["--w" as any]: `${r}%` }} />
      </div>
      <div className="flex justify-between" style={{ fontSize: 10 }}>
        <span style={{ color: "var(--c-green-flag)", fontWeight: 500 }}>{g}% NTA</span>
        <span className="text-c-text-3">live</span>
        <span style={{ color: "var(--c-pink-ink)", fontWeight: 500 }}>{r}% YTA</span>
      </div>
      <div className="text-c-text-3" style={{ fontSize: 10, marginTop: 5 }}>⏱ {formatRemaining(c.closesAt)}</div>
    </button>
  );
}

type StreamCardData = {
  title: string;
  snippet: string;
  cat: string;
  catColor: string;
  catBg: string;
  chipLabel: string;
  chipBg: string;
  bg: string;
  emoji: string;
  ratio: string;
  alias: string;
  aliasEmoji: string;
  hearts: string;
  comments?: number;
  bars: Array<{ color: string; w: number }>;
};


function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function streamToCard(s: StreamStory, i: number): StreamCardData {
  const palette = FALLBACK_STREAM[i % FALLBACK_STREAM.length];
  return {
    ...palette,
    title: s.title,
    snippet: s.snippet || palette.snippet,
    cat: s.category ?? palette.cat,
    hearts: s.viewCount > 0 ? fmtCount(s.viewCount) : palette.hearts,
    comments: s.commentCount,
  };
}


function StreamCard({ s, index, onClick }: { s: StreamCardData; index: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="stream-card block w-full overflow-hidden rounded-[14px] text-left"
      style={{ background: "#fff", border: "0.5px solid var(--c-border)", ["--d" as any]: `${index * 0.07}s` }}
    >
      <div
        className="relative overflow-hidden"
        style={{ width: "100%", aspectRatio: s.ratio, backgroundColor: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <span style={{ fontSize: 78 }}>{s.emoji}</span>
        <span className="absolute" style={{ top: 8, left: 8, fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: s.chipBg, color: "#fff" }}>{s.chipLabel}</span>
        <span className="absolute" style={{ top: 8, right: 8, fontSize: 10, fontWeight: 500, padding: "3px 10px", borderRadius: 999, background: "rgba(255,255,255,.9)", color: "var(--c-text-1)" }}>{s.cat}</span>
      </div>
      <div style={{ padding: "12px 13px 13px", display: "flex", flexDirection: "column", gap: 7 }}>
        <h3 className="text-c-text-1" style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.42, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.title}</h3>
        <p className="text-c-text-2" style={{ fontSize: 11.5, lineHeight: 1.52, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.snippet}</p>
        <div className="flex overflow-hidden rounded-[2px]" style={{ height: 3, background: "rgba(10,8,15,.08)" }}>
          {s.bars.map((b, i) => (
            <div key={i} className="stream-bar" style={{ background: b.color, ["--w" as any]: `${b.w}%` }} />
          ))}
        </div>
        <div className="flex items-center justify-between" style={{ paddingTop: 7, borderTop: "0.5px solid rgba(10,8,15,.07)" }}>
          <div className="flex items-center gap-1.5">
            <span className="flex items-center justify-center rounded-full" style={{ width: 20, height: 20, background: "var(--c-surface-3)", border: "0.5px solid var(--c-border)", fontSize: 12 }}>{s.aliasEmoji}</span>
            <span className="text-c-text-2" style={{ fontSize: 10 }}>{s.alias}</span>
          </div>
          <div className="flex items-center gap-2 text-c-text-3" style={{ fontSize: 10 }}>
            {typeof s.comments === "number" && s.comments > 0 && <span>💬 {fmtCount(s.comments)}</span>}
            <span>👁 {s.hearts}</span>
          </div>

        </div>
      </div>
    </button>
  );
}

// ── Fallback content (only used when DB is empty) ──────────────────────────

const FALLBACK_DOCKET = [
  { title: "Cancelled girlfriend's birthday dinner — she was 3 hrs late to our last date", cat: "Romance",  catColor: "var(--c-pink-ink)", catBg: "rgba(136,0,64,.08)",  g: 68, r: 32, votes: 847,  remaining: "2h 14m remaining" },
  { title: "Refused to share my wedding date so my sister could schedule her due date around it", cat: "Family", catColor: "var(--c-green-flag)", catBg: "rgba(26,158,130,.1)", g: 45, r: 55, votes: 1204, remaining: "4h 38m remaining" },
  { title: "Told my boss I won't stay late unless overtime is in my contract — whole team is cold now", cat: "Work", catColor: "var(--c-amber)", catBg: "rgba(212,134,10,.1)", g: 81, r: 19, votes: 2109, remaining: "1h 02m remaining" },
  { title: "Asked stranger to take screaming toddler outside after 20 minutes in a quiet restaurant", cat: "Stranger", catColor: "var(--c-purple)", catBg: "rgba(107,79,160,.1)", g: 77, r: 23, votes: 3841, remaining: "6h 55m remaining" },
  { title: "Told my landlord fixing the mold is their legal responsibility, refused to pay myself",   cat: "Housing",  catColor: "#1565c0",            catBg: "rgba(21,101,192,.1)", g: 96, r: 4,  votes: 5672, remaining: "closing soon" },
  { title: "Started asking for separate checks with friends who always order far more expensive food",cat: "Friends",  catColor: "var(--c-coral)",     catBg: "rgba(212,80,64,.1)",  g: 89, r: 11, votes: 987,  remaining: "3h 20m remaining" },
];

const FALLBACK_HOF: Array<{ title: string; verdictLabel: string; votes: string }> = [
  { title: "I told my landlord the mold was their problem. They threatened to sue. I called their bluff.", verdictLabel: "99% NTA", votes: "34k votes" },
  { title: "Stopped splitting the bill with friends who order twice as expensive every single time.",      verdictLabel: "97% NTA", votes: "28k votes" },
  { title: "Declined my sister's MLM pitch at our family dinner in front of everyone. She cried.",         verdictLabel: "96% NTA", votes: "21k votes" },
];

const FALLBACK_STREAM: StreamCardData[] = [
  { title: "I went through my boyfriend's phone while he slept and now he knows", snippet: "He left it unlocked. I saw a name I didn't recognise. He found out I looked.", cat: "Romance",  catColor: "var(--c-pink-ink)", catBg: "rgba(136,0,64,.08)",  chipLabel: "🔥 Hot",    chipBg: "var(--c-coral)",     bg: "#ffd0e8", emoji: "💔", ratio: "3/4", alias: "TangerineVixen",  aliasEmoji: "🦊", hearts: "4.2k", bars: [{ color: "var(--c-pink-ink)", w: 72 }, { color: "var(--c-green-flag)", w: 28 }] },
  { title: "My parents showed up to my wedding after I explicitly un-invited them", snippet: "I had a reason. They believe blood means automatic entry to everything.",         cat: "Family",   catColor: "var(--c-green-flag)", catBg: "rgba(26,158,130,.1)", chipLabel: "💜 Warm",   chipBg: "var(--c-purple)",    bg: "#e8f5e9", emoji: "🏠", ratio: "4/3", alias: "CalmBrownBear",   aliasEmoji: "🐻", hearts: "8.8k", bars: [{ color: "var(--c-green-flag)", w: 89 }, { color: "var(--c-pink-ink)", w: 11 }] },
  { title: "Refused overtime. Boss said I'm not a team player. I said, correct.",  snippet: "My contract says 9–5. I said no. Now HR is involved and my team hates me.",         cat: "Work",     catColor: "var(--c-amber)",      catBg: "rgba(212,134,10,.1)", chipLabel: "⚡ On fire", chipBg: "#c8960a",            bg: "#fff3e0", emoji: "💼", ratio: "1/1", alias: "MidnightLioness", aliasEmoji: "🦁", hearts: "12.1k", bars: [{ color: "var(--c-green-flag)", w: 94 }, { color: "var(--c-pink-ink)", w: 6 }] },
  { title: "Told the screaming toddler's parents to please go outside",            snippet: "25 solid minutes in a quiet restaurant. I finally said something.",                cat: "Stranger", catColor: "var(--c-purple)",     catBg: "rgba(107,79,160,.1)", chipLabel: "💜 Warm",   chipBg: "var(--c-purple)",    bg: "#e3f2fd", emoji: "😤", ratio: "3/4", alias: "SilverWolfMoon",  aliasEmoji: "🐺", hearts: "3.5k", bars: [{ color: "var(--c-green-flag)", w: 77 }, { color: "var(--c-amber)", w: 14 }, { color: "var(--c-pink-ink)", w: 9 }] },
  { title: "Cancelled my partner's birthday dinner because they were 3 hrs late last time", snippet: "They cried. I said I gave fair warning weeks ago. The court is split.",  cat: "Romance",  catColor: "var(--c-pink-ink)",   catBg: "rgba(136,0,64,.08)",  chipLabel: "🔥 Hot",    chipBg: "var(--c-coral)",     bg: "#fce4ec", emoji: "🌹", ratio: "4/5", alias: "AzureButterfly",  aliasEmoji: "🦋", hearts: "6.7k", bars: [{ color: "var(--c-green-flag)", w: 55 }, { color: "var(--c-amber)", w: 22 }, { color: "var(--c-pink-ink)", w: 23 }] },
  { title: "Unfollowed my best friend on Instagram. She noticed immediately.",     snippet: "I just didn't want her content in my feed. She says I'm ending the friendship.",  cat: "Digital",  catColor: "var(--c-purple)",     catBg: "rgba(107,79,160,.1)", chipLabel: "🌙 Quiet",  chipBg: "#3d3d3d",            bg: "#ede8f5", emoji: "📱", ratio: "1/1", alias: "CrescentOwlGray", aliasEmoji: "🌙", hearts: "1.9k", bars: [{ color: "var(--c-green-flag)", w: 63 }, { color: "var(--c-amber)", w: 21 }, { color: "var(--c-pink-ink)", w: 16 }] },
  { title: "Cut off a 10-year friend after she skipped my dad's funeral without a word", snippet: "She texted three days later saying she forgot. I haven't responded since.",  cat: "Friends",  catColor: "var(--c-coral)",      catBg: "rgba(212,80,64,.1)",  chipLabel: "💜 Warm",   chipBg: "var(--c-purple)",    bg: "#f3e5f5", emoji: "🍽️", ratio: "4/3", alias: "QuietHibiscus",   aliasEmoji: "🌺", hearts: "9.3k", bars: [{ color: "var(--c-green-flag)", w: 91 }, { color: "var(--c-pink-ink)", w: 9 }] },
  { title: "Reported my neighbour to the council for parking on my drive while I was on holiday", snippet: "They said I should have just asked nicely. I tried that twice before.", cat: "Housing",  catColor: "#1565c0",             catBg: "rgba(21,101,192,.1)", chipLabel: "🔥 Hot",    chipBg: "var(--c-coral)",     bg: "#e0f7fa", emoji: "🏡", ratio: "3/4", alias: "AutumnHedgehog",  aliasEmoji: "🦔", hearts: "5.1k", bars: [{ color: "var(--c-green-flag)", w: 83 }, { color: "var(--c-amber)", w: 10 }, { color: "var(--c-pink-ink)", w: 7 }] },
];

function catFor(badge: string): { label: string; color: string; bg: string } {
  const l = badge.toLowerCase();
  if (l.includes("romance"))  return { label: "Romance",  color: "var(--c-pink-ink)",   bg: "rgba(136,0,64,.08)" };
  if (l.includes("family"))   return { label: "Family",   color: "var(--c-green-flag)", bg: "rgba(26,158,130,.1)" };
  if (l.includes("work"))     return { label: "Work",     color: "var(--c-amber)",      bg: "rgba(212,134,10,.1)" };
  if (l.includes("stranger")) return { label: "Stranger", color: "var(--c-purple)",     bg: "rgba(107,79,160,.1)" };
  if (l.includes("housing"))  return { label: "Housing",  color: "#1565c0",             bg: "rgba(21,101,192,.1)" };
  if (l.includes("friends"))  return { label: "Friends",  color: "var(--c-coral)",      bg: "rgba(212,80,64,.1)" };
  return { label: "Open", color: "var(--c-text-2)", bg: "var(--c-surface-3)" };
}
