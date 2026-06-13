// Shutap marketing homepage — light, anonymous "court of public opinion" design.
// Visual source: uploaded Light_Landing_page.html. Data: real DB via getHomepageData.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getHomepageData,
  type LiveCase,
  type StreamStory,
  type HofEntry,
} from "@/lib/marketing/homepage.functions";
import { headHome } from "@/lib/seo/meta";

export const Route = createFileRoute("/")({
  loader: () => getHomepageData(),
  component: HomePage,
  head: ({ loaderData }) => headHome(loaderData?.totalVerdicts),
  errorComponent: ({ error }) => (
    <main className="min-h-screen grid place-items-center px-6 text-sm" style={{ background: "#fcf1f5", color: "#1b0f16" }}>
      <p className="max-w-md text-center">The bench is unavailable. {error.message}</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="min-h-screen grid place-items-center px-6 text-sm" style={{ background: "#fcf1f5", color: "#1b0f16" }}>
      <p>This case doesn't exist.</p>
    </main>
  ),
});

// ─── helpers ────────────────────────────────────────────────────────────────

const CREATURE_EMOJI: Record<string, string> = {
  fox: "🦊", owl: "🦉", otter: "🦦", wolf: "🐺", bear: "🐻", lion: "🦁",
  tiger: "🐯", panda: "🐼", eagle: "🦅", hawk: "🦅", butterfly: "🦋",
  bee: "🐝", whale: "🐳", dolphin: "🐬", turtle: "🐢", rabbit: "🐰",
  deer: "🦌", horse: "🐴", crane: "🦩", swan: "🦢", duck: "🦆", cat: "🐈",
  dog: "🐕", elephant: "🐘", giraffe: "🦒", koala: "🐨", monkey: "🐒",
  penguin: "🐧", shark: "🦈", snake: "🐍", squirrel: "🐿️", hedgehog: "🦔",
  lizard: "🦎", crow: "🐦‍⬛", raven: "🐦‍⬛", heron: "🦅", lynx: "🐱",
};

const COVERS = [
  "linear-gradient(160deg,#3a1226,#a01e5a)",
  "linear-gradient(160deg,#2a1f3e,#5b46a8)",
  "linear-gradient(160deg,#3a2410,#c9711f)",
  "linear-gradient(160deg,#10302a,#1f8f6b)",
  "linear-gradient(160deg,#3a1020,#c0206a)",
  "linear-gradient(160deg,#1c1f3a,#4a4eb0)",
  "linear-gradient(160deg,#13301c,#2f8a3f)",
  "linear-gradient(160deg,#3a1c10,#c0531f)",
];
const RATIOS = ["3/4", "1/1", "4/5", "1/1", "4/3", "3/4", "4/5", "1/1"];
const MOODS = [
  "🔥 Hot · Romance", "💜 Warm · Family", "⚡ On fire · Work",
  "😤 Warm · Stranger", "🌹 Hot · Romance", "🌙 Quiet · Digital",
  "💜 Warm · Friends", "🔥 Hot · Housing",
];

function aliasEmoji(creature: string | null): string {
  if (!creature) return "✨";
  return CREATURE_EMOJI[creature.toLowerCase()] ?? "✨";
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function useCountdown(iso: string | null | undefined): string {
  const compute = () => {
    if (!iso) return "1h 44m to verdict";
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return "verdict locking";
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    if (h >= 24) return `${Math.floor(h / 24)}d to verdict`;
    if (h >= 1) return `${h}h ${m}m to verdict`;
    return `${Math.max(1, m)}m to verdict`;
  };
  const [v, setV] = useState(compute);
  useEffect(() => {
    setV(compute());
    const id = setInterval(() => setV(compute()), 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);
  return v;
}

// ─── page ───────────────────────────────────────────────────────────────────

function HomePage() {
  const { totalVerdicts, liveCases, hofStats, hofEntries, streamStories } =
    Route.useLoaderData() as import("@/lib/marketing/homepage.functions").HomepageData;
  const navigate = useNavigate();

  const featured = liveCases?.[0] ?? null;
  const featuredCountdown = useCountdown(featured?.closesAt ?? null);

  const handleBench = (q: string, kind?: "spill" | "scan") => {
    if (kind === "spill") return navigate({ to: "/enter", search: { redirect: "/spill" } });
    if (kind === "scan") return navigate({ to: "/enter", search: { redirect: "/scan" } });
    if (/family|court|tier|lagos|world/i.test(q)) return navigate({ to: "/court" });
    if (/like mine|cases/i.test(q)) return navigate({ to: "/stream" });
    return navigate({ to: "/enter", search: { redirect: "/stream" } });
  };

  return (
    <div className="shutap-light">
      <LandingStyles />

      <header className="mast">
        <div className="mast-in">
          <Link to="/" className="brand" aria-label="Shutap">
            <span className="word"><b>shut</b><i>ap</i></span>
          </Link>
          <div className="trust">
            <b>{fmtNum(totalVerdicts || 1_284_503)}</b> verdicts cast · zero real names, ever
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="hero">
          <div className="drift" aria-hidden />
          <div className="wrap">
            <span className="eyebrow"><span className="dot" />The anonymous court of public opinion</span>
            <h1>Spill it.<br /><span className="em">The court decides.</span></h1>
            <p className="lead">
              You walked in mid-session. Read everything — the case, the jury, the verdict forming in real time.
              When you want to take part, you talk to the Bench.
            </p>
            <BenchComposer
              placeholder="Ask the Bench…"
              hint="No menus. No buttons. Just tell the Bench what you want."
              onAsk={handleBench}
              sugs={[
                { q: "Show me Family Court this week" },
                { q: "What's happening in Lagos" },
                { q: "Cases like mine" },
                { q: "Tell the Bench what happened", kind: "spill" },
                { q: "Scan my situation in 60 seconds", kind: "scan" },
              ]}
            />
          </div>
        </section>

        {/* COURT */}
        <section className="divider" id="court">
          <div className="wrap">
            <p className="benchline">Someone is being judged as you read this.</p>
            <FeaturedCase featured={featured} countdown={featuredCountdown} onAsk={handleBench} />
          </div>
        </section>

        {/* STREAM */}
        <section className="divider" id="stream">
          <div className="wrap">
            <div className="stream-head">
              <p className="benchline" style={{ margin: 0 }}>While you were reading, the court was busy.</p>
            </div>
            <Waterfall stories={streamStories} onOpen={(postId) => navigate({ to: "/post/$postId", params: { postId } })} />
            <p className="benchline" style={{ marginTop: 20, fontSize: 16 }}>
              <span>{fmtNum(liveCases.length || 3284)}</span>&nbsp;cases open right now. Tap any to ask the Bench to walk you in.
            </p>
          </div>
        </section>

        {/* HOF */}
        <section className="divider" id="hof">
          <div className="wrap">
            <span className="eyebrow"><span className="dot" />Hall of Fame · The court has a memory</span>
            <div className="hof-stats">
              <div className="st"><b>{fmtNum(hofStats?.verdictsThisWeek || 1842)}</b><span>verdicts this week</span></div>
              <div className="st"><b>{hofStats?.casesDecided || 312}</b><span>cases decided</span></div>
              <div className="st"><b>{hofStats?.unanimousPct || 71}%</b><span>unanimous this month</span></div>
            </div>
            <div className="hof">
              {(hofEntries.length ? hofEntries : FALLBACK_HOF).map((row, i) => (
                <HofRow key={(row as HofEntry).entityId ?? i} row={row as HofEntry} rank={i + 1} navigate={navigate} />
              ))}
            </div>
            <p className="benchline" style={{ marginTop: 20, fontSize: 16 }}>
              Most platforms stop at opinions. Shutap scores the story and remembers it.
            </p>
          </div>
        </section>

        {/* CLOSING */}
        <section className="divider">
          <div className="wrap">
            <span className="eyebrow"><span className="dot" />Your turn</span>
            <h2 className="close-h">Your situation hasn't been heard.</h2>
            <p className="close-sub">
              Tell me what happened — <b>one question at a time</b>. I never write a word for you.
              Not ready to spill? <b>Scan it in sixty seconds</b> and I'll read the situation back to you.
              No forms. You just talk to the Bench.
            </p>
            <BenchComposer
              placeholder="Tell the Bench what happened…"
              onAsk={handleBench}
              sugs={[
                { q: "Tell the Bench what happened", kind: "spill", label: "Spill the whole story" },
                { q: "Scan my situation in 60 seconds", kind: "scan", label: "Scan it in 60 seconds" },
              ]}
            />
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <div className="mission">Shutap — the world's memory of human experience.</div>
          <div className="legal">
            18+ · anonymous · real verdicts · real outcomes ·{" "}
            <Link to="/about" className="underline">Privacy</Link> ·{" "}
            <Link to="/about" className="underline">Community Standards</Link>
          </div>
          <div className="human">In an AI world, stay human</div>
        </div>
      </footer>
    </div>
  );
}

// ─── pieces ─────────────────────────────────────────────────────────────────

function BenchComposer({
  placeholder,
  hint,
  sugs,
  onAsk,
}: {
  placeholder: string;
  hint?: string;
  sugs: Array<{ q: string; kind?: "spill" | "scan"; label?: string }>;
  onAsk: (q: string, kind?: "spill" | "scan") => void;
}) {
  const [val, setVal] = useState("");
  const [focused, setFocused] = useState(false);
  return (
    <div className="bench">
      <form
        className={`bench-field ${focused ? "active" : ""}`}
        onSubmit={(e) => { e.preventDefault(); if (val.trim()) onAsk(val.trim()); }}
      >
        <input
          className="bench-input"
          type="text"
          aria-label={placeholder}
          placeholder={placeholder}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <span className="bench-caret" />
      </form>
      {hint && <div className="bench-hint">{hint}</div>}
      <div className="bench-sugs open">
        {sugs.map((s) => (
          <button key={s.q} type="button" className="sug" onClick={() => onAsk(s.q, s.kind)}>
            <span className="ico">›</span>{s.label ?? s.q}
          </button>
        ))}
      </div>
    </div>
  );
}

function FeaturedCase({
  featured,
  countdown,
  onAsk,
}: {
  featured: LiveCase | null;
  countdown: string;
  onAsk: (q: string, kind?: "spill" | "scan") => void;
}) {
  const navigate = useNavigate();
  const verdicts = [
    { cls: "v-redflag", w: 31, label: "Red flag" },
    { cls: "v-run", w: 19, label: "Run" },
    { cls: "v-therapy", w: 14, label: "Therapy" },
    { cls: "v-update", w: 12, label: "Need update" },
    { cls: "v-lawyer", w: 10, label: "Lawyer up" },
    { cls: "v-talk", w: 9, label: "Talk it out" },
    { cls: "v-greenflag", w: 5, label: "Green flag" },
  ];
  const seats = useMemo(() => {
    const faces = ["😤","🧑","👩","🧔","👱","🧕","👨","🧑‍🦱","👩‍🦰","🧓","👴","👵","🙂","😐","🤨","😶","🧐","😏","🙃","😌","😬","🫤","😑","🧑‍🦲"];
    return Array.from({ length: 28 }, (_, i) => (i >= 24 ? null : faces[i % faces.length]));
  }, []);

  const title = featured?.title ?? "I refused to attend my brother's wedding after he made my abuser the best man — without telling me.";
  const badge = featured?.courtBadge ?? "Family Court · World Tier";
  const openCase = () => featured && navigate({ to: "/post/$postId", params: { postId: featured.postId } });

  return (
    <div className="case ink">
      <div className="ribbon">
        <span className="court-badge">{badge}</span>
        <span className="countdown">{countdown}</span>
      </div>
      <div className="case-body">
        <div className="casemeta">
          <span className="alias">🦅 Defiant Kenyan Heron</span>
          <span className="tag">Family</span><span className="tag">World Tier</span>
        </div>
        <h2 className="case-title" onClick={openCase} style={{ cursor: featured ? "pointer" : "default" }}>{title}</h2>
        <p className="case-q">Does loyalty to family end where your own safety begins?</p>

        <div className="chairs">
          <div className="chair">
            <div className="role"><span className="ava">😤</span> Plaintiff · The Absent Sister</div>
            <div className="who">Testimony filed</div>
            <div className="testimony">"He knew exactly what he was doing when he made that choice. I had no warning."</div>
          </div>
          <div className="vs">vs</div>
          <div className="chair empty">
            <div className="role"><span className="ava">👻</span> Defendant · The Brother</div>
            <div className="who">No response yet</div>
            <div className="testimony">The other chair is empty. The court proceeds regardless.</div>
          </div>
        </div>

        <div className="jury">
          <div className="jury-head">
            <span className="title">⚖ The Bench · Hon. Public Opinion</span>
            <span className="seated"><b>8,214</b> seated</span>
          </div>
          <div className="seats">
            {seats.map((s, i) =>
              <div key={i} className={`seat ${s ? "" : "empty"}`}>{s ?? ""}</div>
            )}
          </div>
          <div className="jury-note"><b>3</b> new jurors seated in the last minute · debate ongoing in the gallery</div>
        </div>

        <p className="onesided">One person's account — the other party has not responded.</p>

        <div className="vlabel"><span>Live verdict — 8,214 jurors</span><span>Seven ways to read it</span></div>
        <div className="vmeter">
          {verdicts.map((v) => <span key={v.cls} className={v.cls} style={{ flexBasis: `${v.w}%` }} />)}
        </div>
        <div className="vkey">
          {verdicts.map((v) => (
            <span key={v.cls}>
              <i style={{ background: `var(--${v.cls.replace("v-", "v-")})` }} className={v.cls + "-i"} />
              {v.label} <b>{v.w}%</b>
            </span>
          ))}
        </div>

        <div className="judgment">
          <span className="jlabel">Final judgment</span>
          {["Not guilty","Guilty","Both at fault","More info"].map((j) => <span key={j} className="jchip">{j}</span>)}
        </div>

        <div className="watching" onClick={() => onAsk("I want to add my verdict")}>
          <span>You're watching the crowd decide. To take a seat and cast your verdict, ask the Bench</span>
          <span className="arr">→</span>
        </div>
      </div>
      <div className="case-foot">
        <span className="relate" onClick={() => onAsk("It happened to me too", "spill")}>
          <svg viewBox="0 0 24 24"><path d="M7 11v9M2 13v5a2 2 0 0 0 2 2h13l3-9h-7l1-5a2 2 0 0 0-2-2l-5 9"/></svg>
          <b>1,204</b>&nbsp;felt this
        </span>
        <span className="otherside" onClick={() => onAsk("I'm someone in this story", "spill")}>
          Are you someone in this story? →
        </span>
      </div>
    </div>
  );
}

function Waterfall({ stories, onOpen }: { stories: StreamStory[]; onOpen: (postId: string) => void }) {
  const list = stories.length ? stories : [];
  const col1: StreamStory[] = [];
  const col2: StreamStory[] = [];
  list.forEach((s, i) => (i % 2 === 0 ? col1 : col2).push(s));
  return (
    <div className="waterfall">
      {[col1, col2].map((col, ci) => (
        <div key={ci} className="wcol">
          {col.map((s, i) => {
            const globalI = ci + i * 2;
            const cover = COVERS[globalI % COVERS.length];
            const ratio = RATIOS[globalI % RATIOS.length];
            const mood = s.category ? `· ${s.category}` : "";
            return (
              <button key={s.postId} type="button" className="xcard" onClick={() => onOpen(s.postId)}>
                <div className="xcover" style={{ background: cover, aspectRatio: ratio }}>
                  <span className="mood">{MOODS[globalI % MOODS.length].split(" · ")[0]} {mood}</span>
                  <span className="creature">{aliasEmoji(s.authorCreature)}</span>
                  <span className="forming">verdict forming</span>
                </div>
                <div className="xbody">
                  <h3>{s.title}</h3>
                  <div className="xfoot">
                    <span className="xauthor">
                      <span className="av">{aliasEmoji(s.authorCreature)}</span>
                      <span>{s.authorAlias}</span>
                    </span>
                    <span className="xlikes">
                      <svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.2 2 4.8 5.3 4.8c2 0 3.2 1.1 3.9 2.2C9.9 5.9 11.1 4.8 13 4.8c3.3 0 4.9 3.4 3.3 6.9C19.5 16.4 12 21 12 21z"/></svg>
                      {fmtNum(s.viewCount || s.commentCount || 0)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const FALLBACK_HOF = [
  { entityId: "f1", postId: null, title: "I quit the job everyone envied — and my dad finally told me he was proud.", score: 9683 },
  { entityId: "f2", postId: null, title: "I babysat for free for a neighbour who dropped me the second she could.", score: 9607 },
  { entityId: "f3", postId: null, title: "I told my therapist I was fine for six months and finally cracked today.", score: 9602 },
];

function HofRow({ row, rank, navigate }: { row: HofEntry; rank: number; navigate: ReturnType<typeof useNavigate> }) {
  const open = () => {
    if (row.postId) navigate({ to: "/post/$postId", params: { postId: row.postId } });
    else navigate({ to: "/hof" });
  };
  return (
    <div className={`hrow ${rank === 1 ? "top" : ""}`} onClick={open} role="button">
      <div className="hrank">#{rank}</div>
      <div className="hmain">
        <h3>{row.title}</h3>
        <span className="honored">Honored · This week</span>
      </div>
      <div className="hscore"><b>{fmtNum(row.score)}</b><span>pts</span></div>
    </div>
  );
}

// ─── inlined CSS from the design source ─────────────────────────────────────

function LandingStyles() {
  return (
    <style>{`
.shutap-light{
  --bg:#fcf1f5;--surface:#ffffff;--surface-2:#f8eef2;--surface-3:#efe4ea;
  --border:rgba(26,12,20,.10);--border-2:rgba(26,12,20,.18);
  --text:#1b0f16;--text-2:#6e5f67;--text-3:#9c8b93;
  --pink:#e0508a;--pink-2:#cf3b7c;--pink-soft:#ffd0e8;--wine:#a01a55;
  --v-redflag:#E24B4A;--v-greenflag:#1D9E75;--v-run:#D85A30;--v-talk:#7F77DD;
  --v-lawyer:#EF9F27;--v-therapy:#5DCAA5;--v-update:#888780;
  --amber:#EF9F27;--teal:#1D9E75;
  --display:'Sora',ui-sans-serif,system-ui,sans-serif;
  --body:'Inter',ui-sans-serif,system-ui,sans-serif;
  --serif:'Newsreader',Georgia,serif;
  --maxw:820px;
  background:var(--bg);color:var(--text);font-family:var(--body);
  font-size:16.5px;line-height:1.55;-webkit-font-smoothing:antialiased;
  min-height:100vh;
}
.shutap-light *{box-sizing:border-box}
.shutap-light a{color:inherit;text-decoration:none}
.shutap-light h1,.shutap-light h2{font-family:var(--display);font-weight:800;margin:0;line-height:1.05;letter-spacing:-.03em}
.shutap-light .wrap{max-width:var(--maxw);margin:0 auto;padding:0 20px}
.shutap-light .underline{text-decoration:underline;text-underline-offset:3px}

.shutap-light .ink{
  --surface:#181320;--surface-2:#211a2b;--surface-3:#2b2336;
  --border:rgba(255,255,255,.10);--border-2:rgba(255,255,255,.18);
  --text:#f4eff3;--text-2:#a99fa8;--text-3:#7a6f7a;--pink-2:#f090b8;
  color:var(--text);
}

.shutap-light .mast{position:sticky;top:0;z-index:40;background:rgba(252,241,245,.8);backdrop-filter:blur(16px);border-bottom:.5px solid var(--border)}
.shutap-light .mast-in{max-width:var(--maxw);margin:0 auto;padding:11px 20px;display:flex;align-items:center;justify-content:space-between;gap:14px}
.shutap-light .brand{display:flex;align-items:center;gap:10px}
.shutap-light .brand .word{font-family:var(--display);font-weight:800;font-size:19px;letter-spacing:-.04em}
.shutap-light .brand .word b{color:var(--text)}
.shutap-light .brand .word i{color:var(--pink-2);font-style:normal}
.shutap-light .trust{font-size:12px;color:var(--text-3);text-align:right}
.shutap-light .trust b{color:var(--text-2);font-variant-numeric:tabular-nums;font-weight:600}

.shutap-light .benchline{font-family:var(--serif);font-style:italic;color:var(--text-2);font-size:18px;margin:0;display:flex;align-items:baseline;gap:10px}
.shutap-light .benchline::before{content:"";flex:none;width:6px;height:6px;border-radius:50%;background:var(--pink);transform:translateY(-3px);box-shadow:0 0 0 4px rgba(240,96,160,.14)}
.shutap-light .benchline b{color:var(--pink-2);font-style:normal;font-family:var(--display);font-weight:700}

.shutap-light section{padding:46px 0;position:relative}
.shutap-light .divider{border-top:.5px solid var(--border)}
.shutap-light .eyebrow{display:inline-flex;align-items:center;gap:8px;font-family:var(--display);font-weight:700;font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--pink-2)}
.shutap-light .eyebrow .dot{width:6px;height:6px;border-radius:50%;background:var(--pink);box-shadow:0 0 0 4px rgba(240,96,160,.14)}

.shutap-light .hero{padding:60px 0 30px;position:relative;overflow:hidden}
.shutap-light .hero .drift{position:absolute;inset:-50% 10% auto -30%;height:560px;background:radial-gradient(ellipse at center,rgba(240,96,160,.18),transparent 60%);pointer-events:none}
.shutap-light .hero h1{font-size:clamp(42px,9vw,66px);margin:16px 0 14px}
.shutap-light .hero h1 .em{background:linear-gradient(92deg,#f060a0,#c0206a 55%,#880040);-webkit-background-clip:text;background-clip:text;color:transparent}
.shutap-light .hero .lead{font-size:18px;color:var(--text-2);max-width:50ch;margin:0 0 26px;line-height:1.55}

.shutap-light .bench{position:relative;z-index:2}
.shutap-light .bench-field{display:flex;align-items:center;gap:12px;background:linear-gradient(180deg,#211a2b,#161019);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:14px 16px;cursor:text;transition:border-color .2s,box-shadow .25s}
.shutap-light .bench-field.active,.shutap-light .bench-field:focus-within{border-color:var(--pink);box-shadow:0 0 0 4px rgba(224,80,138,.18),0 18px 50px -26px rgba(192,32,106,.45)}
.shutap-light .bench-input{flex:1;background:none;border:none;outline:none;color:#f4eff3;font-family:var(--body);font-size:16px}
.shutap-light .bench-input::placeholder{color:#8a7f8a}
.shutap-light .bench-caret{width:8px;height:8px;border-radius:50%;background:var(--pink);flex:none;animation:shutap-pulse 1.6s infinite}
@keyframes shutap-pulse{0%{box-shadow:0 0 0 0 rgba(240,96,160,.5)}70%{box-shadow:0 0 0 8px rgba(240,96,160,0)}100%{box-shadow:0 0 0 0 rgba(240,96,160,0)}}
.shutap-light .bench-hint{margin-top:11px;font-size:13px;color:var(--text-3)}
.shutap-light .bench-sugs{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}
.shutap-light .sug{font-size:13px;color:var(--text);background:var(--surface-3);border:.5px solid var(--border);border-radius:999px;padding:7px 13px;cursor:pointer;font-family:var(--body);transition:border-color .15s,transform .12s}
.shutap-light .sug:hover{border-color:var(--pink);transform:translateY(-1px)}
.shutap-light .sug .ico{color:var(--pink-2);margin-right:6px;font-weight:700}

.shutap-light .vlabel{display:flex;justify-content:space-between;font-size:12px;color:var(--text-3);margin-bottom:8px;font-weight:500}
.shutap-light .vmeter{height:30px;border-radius:9px;background:var(--surface-3);overflow:hidden;display:flex}
.shutap-light .vmeter>span{height:100%;display:block;transition:flex-basis .9s cubic-bezier(.4,0,.2,1)}
.shutap-light .v-redflag{background:var(--v-redflag)}.shutap-light .v-run{background:var(--v-run)}
.shutap-light .v-therapy{background:var(--v-therapy)}.shutap-light .v-update{background:var(--v-update)}
.shutap-light .v-lawyer{background:var(--v-lawyer)}.shutap-light .v-talk{background:var(--v-talk)}
.shutap-light .v-greenflag{background:var(--v-greenflag)}
.shutap-light .vkey{display:flex;flex-wrap:wrap;gap:9px 15px;margin-top:13px;font-size:12.5px;color:var(--text-2)}
.shutap-light .vkey span{display:inline-flex;align-items:center;gap:6px}
.shutap-light .vkey i{width:9px;height:9px;border-radius:3px;display:inline-block}
.shutap-light .vkey b{color:var(--text);font-variant-numeric:tabular-nums}
.shutap-light .v-redflag-i{background:var(--v-redflag)}.shutap-light .v-run-i{background:var(--v-run)}
.shutap-light .v-therapy-i{background:var(--v-therapy)}.shutap-light .v-update-i{background:var(--v-update)}
.shutap-light .v-lawyer-i{background:var(--v-lawyer)}.shutap-light .v-talk-i{background:var(--v-talk)}
.shutap-light .v-greenflag-i{background:var(--v-greenflag)}

.shutap-light .case{background:linear-gradient(180deg,var(--surface-2),var(--surface));border:.5px solid var(--border-2);border-radius:20px;overflow:hidden;box-shadow:0 30px 66px -40px rgba(70,8,38,.5),0 2px 8px rgba(70,8,38,.06);margin-top:18px}
.shutap-light .ribbon{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 20px;border-bottom:.5px solid var(--border);flex-wrap:wrap}
.shutap-light .court-badge{font-family:var(--display);font-weight:700;font-size:12px;color:var(--text)}
.shutap-light .countdown{font-family:var(--display);font-weight:700;font-size:13px;color:var(--amber);font-variant-numeric:tabular-nums}
.shutap-light .case-body{padding:22px 20px}
.shutap-light .casemeta{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:14px}
.shutap-light .alias{display:inline-flex;align-items:center;gap:7px;background:var(--surface-3);border:.5px solid var(--border);border-radius:999px;padding:5px 12px;font-size:13px;font-weight:500}
.shutap-light .tag{font-size:10.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--text-2);border:.5px solid var(--border);border-radius:999px;padding:4px 9px}
.shutap-light .case-title{font-family:var(--display);font-weight:700;font-size:clamp(20px,4.4vw,26px);line-height:1.2;margin:0 0 11px}
.shutap-light .case-q{font-family:var(--serif);font-style:italic;color:var(--pink-soft);font-size:18px;margin:0 0 14px}

.shutap-light .chairs{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:stretch;margin-bottom:20px}
.shutap-light .chair{background:var(--surface);border:.5px solid var(--border);border-radius:14px;padding:14px}
.shutap-light .chair .role{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3)}
.shutap-light .chair .role .ava{font-size:18px}
.shutap-light .chair .who{font-family:var(--display);font-weight:700;font-size:14.5px;margin:7px 0 6px;color:var(--text)}
.shutap-light .chair .testimony{font-family:var(--serif);font-style:italic;font-size:14px;color:var(--text-2);line-height:1.45}
.shutap-light .chair.empty{border-style:dashed;display:flex;flex-direction:column;justify-content:center}
.shutap-light .chair.empty .testimony{color:var(--text-3)}
.shutap-light .vs{align-self:center;font-family:var(--display);font-weight:800;font-size:13px;color:var(--pink-2)}

.shutap-light .jury{background:var(--surface);border:.5px solid var(--border);border-radius:14px;padding:16px;margin-bottom:18px}
.shutap-light .jury-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:13px}
.shutap-light .jury-head .title{font-family:var(--display);font-weight:700;font-size:13px;color:var(--text);display:flex;align-items:center;gap:7px}
.shutap-light .jury-head .seated{font-size:12.5px;color:var(--text-2)}
.shutap-light .jury-head .seated b{color:var(--pink-2);font-variant-numeric:tabular-nums}
.shutap-light .seats{display:grid;grid-template-columns:repeat(auto-fill,minmax(30px,1fr));gap:7px}
.shutap-light .seat{aspect-ratio:1;border-radius:50%;background:var(--surface-3);border:.5px solid var(--border);display:grid;place-items:center;font-size:15px}
.shutap-light .seat.empty{background:transparent;border-style:dashed;color:transparent}
.shutap-light .jury-note{margin-top:12px;font-size:12px;color:var(--text-3);font-style:italic;font-family:var(--serif)}
.shutap-light .jury-note b{color:var(--pink-2);font-style:normal;font-family:var(--body);font-weight:600}

.shutap-light .onesided{font-size:12.5px;color:var(--text-3);margin:14px 0 18px;display:flex;align-items:center;gap:8px}
.shutap-light .onesided::before{content:"";width:14px;height:1px;background:var(--text-3)}
.shutap-light .judgment{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;align-items:center}
.shutap-light .judgment .jlabel{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-right:2px}
.shutap-light .jchip{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-2);border:.5px solid var(--border);border-radius:999px;padding:5px 11px}
.shutap-light .case-foot{padding:14px 20px;border-top:.5px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.shutap-light .relate{display:inline-flex;align-items:center;gap:8px;font-size:13.5px;color:var(--text-2);cursor:pointer}
.shutap-light .relate svg{width:16px;height:16px;stroke:var(--teal);fill:none;stroke-width:2}
.shutap-light .relate b{color:var(--text);font-variant-numeric:tabular-nums}
.shutap-light .otherside{font-size:13px;color:var(--text-2);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.shutap-light .otherside:hover{color:var(--pink-2)}
.shutap-light .watching{margin-top:16px;font-size:13.5px;color:var(--text-3);display:flex;align-items:center;gap:8px;cursor:pointer}
.shutap-light .watching:hover{color:var(--pink-2)}.shutap-light .watching .arr{color:var(--pink)}

.shutap-light .stream-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:16px}
.shutap-light .waterfall{display:flex;gap:14px;align-items:flex-start}
.shutap-light .wcol{flex:1;display:flex;flex-direction:column;gap:14px;min-width:0}
.shutap-light .xcard{background:var(--surface);border:.5px solid var(--border);border-radius:16px;overflow:hidden;cursor:pointer;transition:transform .16s,border-color .18s;text-align:left;padding:0;width:100%;font-family:var(--body);color:inherit}
.shutap-light .xcard:hover{transform:translateY(-3px);border-color:var(--pink)}
.shutap-light .xcover{position:relative;display:grid;place-items:center;overflow:hidden}
.shutap-light .xcover .creature{font-size:54px;filter:drop-shadow(0 6px 16px rgba(0,0,0,.4));z-index:1}
.shutap-light .xcover .mood{position:absolute;top:9px;left:9px;z-index:2;font-size:11px;font-weight:700;color:#fff;background:rgba(0,0,0,.34);backdrop-filter:blur(4px);border-radius:999px;padding:4px 9px;letter-spacing:.02em;max-width:calc(100% - 18px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.shutap-light .xcover .forming{position:absolute;bottom:9px;right:9px;z-index:2;font-size:10.5px;color:#fff;background:rgba(0,0,0,.34);backdrop-filter:blur(4px);border-radius:999px;padding:3px 8px;font-style:italic;font-family:var(--serif)}
.shutap-light .xbody{padding:12px 13px 13px}
.shutap-light .xbody h3{font-family:var(--display);font-weight:700;font-size:14.5px;line-height:1.28;margin:0 0 11px;color:var(--text)}
.shutap-light .xfoot{display:flex;align-items:center;justify-content:space-between;gap:8px}
.shutap-light .xauthor{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-2);min-width:0}
.shutap-light .xauthor .av{width:20px;height:20px;border-radius:50%;background:var(--surface-3);display:grid;place-items:center;font-size:12px;flex:none}
.shutap-light .xauthor span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.shutap-light .xlikes{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--text-3);flex:none}
.shutap-light .xlikes svg{width:14px;height:14px;stroke:var(--text-3);fill:none;stroke-width:2}

.shutap-light .hof-stats{display:flex;gap:26px;flex-wrap:wrap;margin:16px 0 22px}
.shutap-light .hof-stats .st b{font-family:var(--display);font-weight:800;font-size:26px;color:var(--text);display:block;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.shutap-light .hof-stats .st span{font-size:12px;color:var(--text-3);font-weight:500}
.shutap-light .hof{display:flex;flex-direction:column;gap:12px;margin-top:4px}
.shutap-light .hrow{display:flex;align-items:center;gap:16px;background:var(--surface);border:.5px solid var(--border);border-radius:16px;padding:16px 18px;cursor:pointer;transition:transform .16s,border-color .18s}
.shutap-light .hrow:hover{transform:translateY(-2px);border-color:var(--pink)}
.shutap-light .hrow.top{border-color:rgba(239,159,39,.55);background:linear-gradient(180deg,#fff8ec,#fff)}
.shutap-light .hrank{font-family:var(--display);font-weight:800;font-size:13px;color:var(--text-3);flex:none;width:30px}
.shutap-light .hrow.top .hrank{color:var(--amber)}
.shutap-light .hmain{flex:1;min-width:0}
.shutap-light .hmain h3{font-family:var(--serif);font-style:italic;font-weight:500;font-size:16px;line-height:1.3;color:var(--text);margin:0 0 7px}
.shutap-light .honored{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.04em;color:#c47d10;text-transform:uppercase}
.shutap-light .honored::before{content:"⚖";font-style:normal}
.shutap-light .hscore{flex:none;text-align:right}
.shutap-light .hscore b{font-family:var(--display);font-weight:800;font-size:23px;color:var(--text);display:block;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.shutap-light .hscore span{font-size:10.5px;color:var(--text-3);letter-spacing:.1em;text-transform:uppercase}
.shutap-light .hrow.top .hscore b{background:linear-gradient(92deg,#EF9F27,#b9740d);-webkit-background-clip:text;background-clip:text;color:transparent}

.shutap-light .close-h{font-size:clamp(26px,6vw,40px);margin:14px 0 12px}
.shutap-light .close-sub{font-size:17px;color:var(--text-2);max-width:52ch;margin:0 0 22px;line-height:1.55}
.shutap-light .close-sub b{color:var(--text);font-weight:600}

.shutap-light footer{padding:30px 0 30px;color:var(--text-3);font-size:13px;text-align:center}
.shutap-light footer .mission{font-family:var(--display);font-weight:600;color:var(--text-2);margin-bottom:8px}
.shutap-light footer .legal{font-size:12px}
.shutap-light footer .human{margin-top:14px;font-family:var(--display);font-weight:700;font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--text-3)}

@media (max-width:560px){
  .shutap-light .chairs{grid-template-columns:1fr}
  .shutap-light .vs{display:none}
  .shutap-light .hrow{gap:12px}
  .shutap-light .hscore b{font-size:20px}
}
    `}</style>
  );
}
