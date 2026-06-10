import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { CourtCase } from "@/lib/court.functions";

type VKey = "rf" | "gf" | "run" | "talk" | "law" | "th" | "up";

const VERDICTS: { key: VKey; em: string; label: string }[] = [
  { key: "rf", em: "🚩", label: "Red flag" },
  { key: "gf", em: "💚", label: "Green flag" },
  { key: "run", em: "🏃", label: "Run" },
  { key: "talk", em: "🗣️", label: "Talk it out" },
  { key: "law", em: "⚖️", label: "Lawyer up" },
  { key: "th", em: "🛋️", label: "Therapy" },
  { key: "up", em: "👀", label: "Need update" },
];

const VHINT: Record<VKey, string> = {
  rf: "The court sees a red flag too.",
  gf: "A rare green flag. Interesting.",
  run: "Most jurors agree with you.",
  talk: "Brave. Most say run.",
  law: "Smart. There are receipts.",
  th: "Both of you. Clearly.",
  up: "The case needs more.",
};

type JKey = "guilty" | "notguilty" | "fault" | "more";
const JTEXT: Record<JKey, string> = {
  guilty: "You sided with the plaintiff. The jury leans your way.",
  notguilty: "Bold. Few jurors agreed. The Bench is intrigued.",
  fault: "Shared fault. The Bench notes the nuance.",
  more: "The jury wants more. He still hasn't responded.",
};

const JURORS = [
  { e: "😤", n: "Furious Ghanaian Eagle", v: "run" as VKey },
  { e: "🦅", n: "Bold Rwandan Hawk", v: "law" as VKey },
  { e: "🌿", n: "Hopeful Lagos Fern", v: "th" as VKey },
  { e: "🦋", n: "Wistful Kenyan Moth", v: "rf" as VKey },
  { e: "🐙", n: "Calm Ugandan Octopus", v: "talk" as VKey },
  { e: "🦉", n: "Angry Nairobi Owl", v: "run" as VKey },
  { e: "🦎", n: "Quiet Lagos Lizard", v: "up" as VKey },
  { e: "🐦", n: "Furious Accra Sparrow", v: "run" as VKey },
  { e: "🌺", n: "Hopeful Abuja Rose", v: "law" as VKey },
  { e: "🦊", n: "Wry Kampala Fox", v: "th" as VKey },
  { e: "🐬", n: "Bold Dakar Dolphin", v: "gf" as VKey },
];

const ACTS = [
  "Furious Ghanaian Eagle joined — voted 🏃 Run",
  "Bold Rwandan Hawk is deliberating…",
  "Hopeful Lagos Fern voted 🛋️ Therapy",
  "Wistful Kenyan Moth: 🚩 Red flag. No question.",
  "Calm Ugandan Octopus: \"I need more context.\"",
  "The Bench notes the jury is filling.",
  "Angry Nairobi Owl voted 🏃 Run. Loudly.",
  "Quiet Lagos Lizard slipped in silently.",
  "Furious Accra Sparrow: still running 🏃",
  "Hopeful Abuja Rose voted ⚖️ Lawyer up.",
  "Bold Dakar Dolphin surprised everyone — 💚",
];

const SEATS = 11;

function deriveCounts(c: CourtCase | null): Record<VKey, number> {
  const fallback = { rf: 12, gf: 5, run: 38, talk: 20, law: 10, th: 11, up: 4 };
  const raw = c?.verdict?.counts as Record<string, number> | undefined;
  if (!raw) return fallback;
  const map: Record<string, VKey> = {
    red_flag: "rf", green_flag: "gf", run: "run", talk: "talk",
    talk_it_out: "talk", lawyer_up: "law", therapy: "th", need_update: "up",
  };
  const out = { ...fallback };
  for (const [k, v] of Object.entries(raw)) {
    const mk = map[k];
    if (mk && typeof v === "number") out[mk] = v;
  }
  return out;
}

function timeLeft(closesAt: string | null | undefined): string {
  if (!closesAt) return "Live deliberations";
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return "Closing arguments";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 24) return `${Math.floor(h / 24)} days left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export function CaseFlow({ c }: { c: CourtCase | null }) {
  const baseCounts = useMemo(() => deriveCounts(c), [c]);
  const baseTotal = useMemo(
    () => Object.values(baseCounts).reduce((a, b) => a + b, 0),
    [baseCounts],
  );

  const [myVote, setMyVote] = useState<VKey | null>(null);
  const [myJudge, setMyJudge] = useState<JKey | null>(null);
  const [done, setDone] = useState(false);
  const [filled, setFilled] = useState(0);
  const [activity, setActivity] = useState("Tap an empty seat to join the jury.");
  const [activityHot, setActivityHot] = useState(false);
  const [hint, setHint] = useState("");
  const [hintHot, setHintHot] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [comments, setComments] = useState<{ av: string; name: string; body: string }[]>([
    { av: "😤", name: "Furious Kenyan Eagle · 2h ago", body: "Four cities of lies. She didn't leave him — she graduated from him." },
    { av: "🦋", name: "Hopeful Lagos Moth · 4h ago", body: "He proposed in PARIS and then had the audacity. Paris." },
    { av: "🦉", name: "Wistful Nairobi Owl · 6h ago", body: "She left him in Seoul. The poetry of that. I'm not okay." },
  ]);
  const [commentText, setCommentText] = useState("");
  const [related, setRelated] = useState(false);
  const [shared, setShared] = useState(false);
  const fillTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-fill seats over time.
  useEffect(() => {
    if (filled >= SEATS) return;
    const delay = filled === 0 ? 1800 : Math.random() * 3500 + 1200;
    fillTimer.current = setTimeout(() => setFilled((n) => Math.min(SEATS, n + 1)), delay);
    return () => { if (fillTimer.current) clearTimeout(fillTimer.current); };
  }, [filled]);

  useEffect(() => {
    if (filled === 0) return;
    setActivity(ACTS[filled - 1] ?? "The jury deliberates…");
    setActivityHot(true);
    const t = setTimeout(() => setActivityHot(false), 2200);
    return () => clearTimeout(t);
  }, [filled]);

  const counts = useMemo(() => {
    const v = { ...baseCounts };
    if (myVote) v[myVote] = (v[myVote] ?? 0) + 1;
    return v;
  }, [baseCounts, myVote]);
  const total = baseTotal + (myVote ? 1 : 0);
  const pct = (k: VKey) => (total === 0 ? 0 : Math.round((counts[k] / total) * 100));

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const onVote = (k: VKey) => {
    if (done) return;
    setMyVote(k);
    setHint(VHINT[k]);
    setHintHot(true);
    setTimeout(() => setHintHot(false), 2000);
    if (filled < SEATS) setFilled((n) => n + 1);
  };

  const submit = () => {
    if (!myVote || !myJudge || done) return;
    setDone(true);
    showToast("⚖️ On the record.");
    // fast-fill remaining seats
    let r = SEATS - filled;
    let i = 0;
    const tick = () => {
      if (i++ >= r) return;
      setFilled((n) => Math.min(SEATS, n + 1));
      setTimeout(tick, 180);
    };
    tick();
  };

  const addComment = () => {
    const t = commentText.trim();
    if (!t) return;
    const avs = ["😤", "🦅", "🌿", "🦋", "🐙", "🦉", "🦎", "🐦", "🌺", "🦊", "🐬"];
    setComments((c) => [
      ...c,
      { av: avs[Math.floor(Math.random() * avs.length)], name: "You · just now", body: t },
    ]);
    setCommentText("");
  };

  const shareCase = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: c?.post?.title ?? "Relationship Court", url });
      } else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch { /* user dismissed */ }
  };

  const caseNo = c ? `CASE #${String(c.id).slice(0, 4).toUpperCase()}` : "CASE #902";
  const title = c?.post?.title ?? "He proposed in Paris. Cheated in Bali. Honeymooned in Tokyo. I left in Seoul.";
  const tagline = c?.aiSummary ?? "What would you do if you were her?";
  const tier = c?.currentTier === "world" ? "World" : c?.currentTier === "national" ? "National" : c?.currentTier === "regional" ? "Regional" : "City";

  return (
    <div className="cf-root">
      {/* CASE HERO */}
      <section className="cf-hero">
        <span aria-hidden className="cf-ghost">{caseNo}</span>
        <div className="cf-eyebrow">Case · Family Court · {tier} tier</div>
        <h2 className="cf-title">"{title}"</h2>
        <p className="cf-q">{tagline}</p>
        <span className="cf-timer">⏱ {timeLeft(c?.closesAt)}</span>
      </section>

      {/* PARTIES */}
      <section className="cf-section">
        <div className="cf-eyebrow-row">The parties</div>
        <div className="cf-parties">
          <div className="cf-party cf-party--p">
            <div className="cf-plabel">Plaintiff</div>
            <div className="cf-pav">😤</div>
            <div className="cf-pname">The Leaver</div>
            <div className="cf-pstatus cf-pstatus--p">Testimony filed</div>
            <div className="cf-pquote">"Four cities. Four versions of him. The Seoul one was finally honest."</div>
          </div>
          <div className="cf-vs">vs</div>
          <div className="cf-party cf-party--d">
            <div className="cf-plabel">Defendant</div>
            <div className="cf-pav">👻</div>
            <div className="cf-pname">The Absent</div>
            <div className="cf-pstatus cf-pstatus--d">No response</div>
            <div className="cf-pabsent">Empty chair. The court notes his silence.</div>
          </div>
        </div>
      </section>

      {/* LIVE VERDICT BAR */}
      <section className="cf-section">
        <div className="cf-eyebrow-row">
          Live verdict <span className="cf-eyebrow-aux">{total.toLocaleString()} votes</span>
        </div>
        <div className="cf-vbar">
          {VERDICTS.map((v) => (
            <div key={v.key} className={`cf-vs cf-vs--${v.key}`} style={{ flexBasis: `${pct(v.key)}%` }} />
          ))}
        </div>
        <div className="cf-vlegend">
          {VERDICTS.map((v) => (
            <span key={v.key} className="cf-vleg">
              <span className={`cf-vleg-dot cf-vs--${v.key}`} />
              {pct(v.key)}% {v.label}
            </span>
          ))}
        </div>
      </section>

      {/* JURY */}
      <section className="cf-section">
        <div className="cf-eyebrow-row">
          The jury <span className="cf-eyebrow-aux">you + {filled} seated</span>
        </div>
        <div className="cf-bench-strip">
          <div className="cf-bench-av">⚖️</div>
          <div className="cf-bench-txt">
            <div className="cf-bench-name">The Bench · Hon. Public Opinion</div>
            <div className="cf-bench-role">Presiding — jury verdict required</div>
          </div>
        </div>
        <div className="cf-seats">
          <div className={`cf-seat cf-seat--you${myVote ? ` cf-seat--voted-${myVote}` : ""}`}>
            {myVote ? VERDICTS.find((v) => v.key === myVote)!.em : "🫵"}
          </div>
          {Array.from({ length: SEATS }).map((_, i) => {
            const j = JURORS[i % JURORS.length];
            const isFilled = i < filled;
            return (
              <div
                key={i}
                className={`cf-seat ${isFilled ? `cf-seat--filled cf-seat--voted-${j.v}` : "cf-seat--empty"}`}
              >
                {isFilled ? j.e : ""}
              </div>
            );
          })}
        </div>
        <div className={`cf-activity${activityHot ? " cf-activity--hot" : ""}`}>{activity}</div>
      </section>

      {/* CAST VERDICT */}
      <section className="cf-section">
        <div className="cf-eyebrow-row">
          Cast your verdict <span className="cf-eyebrow-aux">{myVote ? "tap again to change" : "pick one"}</span>
        </div>
        <div className="cf-vgrid">
          {VERDICTS.slice(0, 6).map((v) => (
            <button
              key={v.key}
              onClick={() => onVote(v.key)}
              className={`cf-vbtn cf-vbtn--${v.key}${myVote === v.key ? " cf-vbtn--active" : ""}`}
            >
              <span className="cf-vbtn-em">{v.em}</span>
              {v.label}
              <span className="cf-vbtn-pct">{pct(v.key)}%</span>
            </button>
          ))}
          <button
            onClick={() => onVote("up")}
            className={`cf-vbtn cf-vbtn--up cf-vbtn--full${myVote === "up" ? " cf-vbtn--active" : ""}`}
          >
            <span className="cf-vbtn-em">👀</span>
            Need update
            <span className="cf-vbtn-pct">{pct("up")}%</span>
          </button>
        </div>
        <div className={`cf-vhint${hintHot ? " cf-vhint--hot" : ""}`}>{hint}</div>
      </section>

      {/* JUDGMENT */}
      <section className="cf-section">
        <div className="cf-eyebrow-row">
          Final judgment <span className="cf-eyebrow-aux">structural — different from your verdict</span>
        </div>
        <div className="cf-jgrid">
          {([
            { k: "guilty", t: "😈 Guilty" },
            { k: "notguilty", t: "😇 Not guilty" },
            { k: "fault", t: "🤝 Both at fault" },
            { k: "more", t: "🔍 Need more info" },
          ] as { k: JKey; t: string }[]).map((j) => (
            <button
              key={j.k}
              onClick={() => !done && setMyJudge(j.k)}
              className={`cf-jbtn${myJudge === j.k ? ` cf-jbtn--${j.k}` : ""}`}
            >
              {j.t}
            </button>
          ))}
        </div>
      </section>

      {/* SUBMIT + REACTION */}
      <section className="cf-section">
        <button
          className="cf-cta"
          onClick={submit}
          disabled={!myVote || !myJudge || done}
        >
          {done
            ? "✓ Verdict recorded"
            : myVote && myJudge
              ? "⚖️ Submit your verdict"
              : myVote
                ? "Now pick your final judgment above"
                : "Submit your verdict"}
        </button>
        {done && myJudge && (
          <div className="cf-reaction">
            <div className="cf-reaction-eyebrow">The Bench observes</div>
            <div className="cf-reaction-body">{JTEXT[myJudge]}</div>
            <Link to="/spill" className="cf-reaction-cta">Have a story like this? Open your case. →</Link>
          </div>
        )}
      </section>

      {/* GALLERY */}
      <section className="cf-section">
        <div className="cf-eyebrow-row">
          Public gallery <span className="cf-eyebrow-aux">{comments.length} comments</span>
        </div>
        <div>
          {comments.map((c, i) => (
            <div key={i} className="cf-comment">
              <div className="cf-cav">{c.av}</div>
              <div>
                <div className="cf-cname">{c.name}</div>
                <div className="cf-cbody">{c.body}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="cf-cinput">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addComment(); }}
            placeholder="Address the court…"
          />
          <button onClick={addComment}>Submit</button>
        </div>
        <div className="cf-trust">
          <span><strong>{(baseTotal + 4_214_000).toLocaleString()}</strong> verdicts cast</span>
          <span>Zero real names. Ever.</span>
        </div>
        <div className="cf-share">
          <button
            className={`cf-sbtn${related ? " cf-sbtn--active" : ""}`}
            onClick={() => { setRelated((v) => !v); showToast(related ? "Removed." : "Added to your story."); }}
          >
            {related ? "🙋 Added to your story" : "🙋 Happened to me"}
          </button>
          <button className={`cf-sbtn${shared ? " cf-sbtn--active" : ""}`} onClick={shareCase}>
            {shared ? "✓ Copied" : "🔗 Share case"}
          </button>
        </div>
      </section>

      {toast && <div className="cf-toast">{toast}</div>}
    </div>
  );
}
