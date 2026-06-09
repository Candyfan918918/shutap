// "Are you someone in this story?" entry + list of verified perspectives.
// Bench-voice copy throughout. All gated CTAs route through useGateStore.
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useGateStore } from "@/stores/gate";
import {
  listPerspectives,
  startPerspective,
  submitStandingFacts,
  submitPerspectiveResponse,
  togglePerspectiveRelate,
} from "@/lib/perspectives.functions";

type Role = "named_party" | "participant" | "witness";

type Perspective = {
  id: string;
  responder_id: string;
  role: Role;
  response_text: string | null;
  relate_count: number;
  comment_count: number;
  locked_at: string | null;
  created_at: string;
};

const ROLE_LABEL: Record<Role, string> = {
  named_party: "Named party",
  participant: "Participant",
  witness: "Witness",
};

const ROLE_BENCH: Record<Role, string> = {
  named_party: "You are accused. Speak in full.",
  participant: "You were there. Add what was missed.",
  witness: "You watched. Submit your statement.",
};

export function OtherPerspectives({ postId, plaintiffId }: { postId: string; plaintiffId: string }) {
  const list = useServerFn(listPerspectives);
  const enqueue = useGateStore((s) => s.enqueue);
  const [perspectives, setPerspectives] = useState<Perspective[]>([]);
  const [authedId, setAuthedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthedId(data.user?.id ?? null));
  }, []);

  const refresh = async () => {
    try {
      const { perspectives } = await list({ data: { post_id: postId } });
      setPerspectives(perspectives as Perspective[]);
    } catch {/* silent */}
  };
  useEffect(() => { void refresh(); }, [postId]);

  const isPlaintiff = authedId && authedId === plaintiffId;

  return (
    <section className="space-y-3">
      {!isPlaintiff && (
        <button
          type="button"
          onClick={() => {
            if (!authedId) {
              enqueue({ type: "comment", entityId: postId });
              return;
            }
            setOpen(true);
          }}
          className="w-full rounded-2xl border border-border bg-surface-elevated px-5 py-4 text-left transition hover:border-primary/50"
        >
          <div className="text-base font-medium">Are you someone in this story?</div>
          <div className="text-sm text-muted-foreground mt-0.5">
            If you were there, the court will hear you.
          </div>
        </button>
      )}

      {perspectives.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Other Perspectives</h3>
          {perspectives.map((p) => (
            <PerspectiveCard key={p.id} perspective={p} />
          ))}
        </div>
      )}

      {open && (
        <PerspectiveSheet
          postId={postId}
          onClose={() => { setOpen(false); void refresh(); }}
        />
      )}
    </section>
  );
}

function PerspectiveCard({ perspective }: { perspective: Perspective }) {
  const relate = useServerFn(togglePerspectiveRelate);
  const enqueue = useGateStore((s) => s.enqueue);
  const [count, setCount] = useState(perspective.relate_count);
  const [related, setRelated] = useState(false);

  return (
    <article className="rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {ROLE_LABEL[perspective.role]}
        </span>
        {perspective.locked_at && (
          <span className="text-xs text-muted-foreground">· locked</span>
        )}
      </div>
      <p className="mt-2 text-sm whitespace-pre-wrap">{perspective.response_text}</p>
      <div className="mt-3 flex items-center gap-4 text-sm">
        <button
          type="button"
          onClick={async () => {
            try {
              const { related: r } = await relate({ data: { perspective_id: perspective.id } });
              setRelated(r);
              setCount((c) => c + (r ? 1 : -1));
            } catch {
              enqueue({ type: "relate", entityId: perspective.id });
            }
          }}
          className={`rounded-full border border-border px-3 py-1 text-xs ${related ? "bg-primary/10 border-primary/50" : ""}`}
        >
          Relate · {count}
        </button>
        <span className="text-xs text-muted-foreground">{perspective.comment_count} replies</span>
      </div>
    </article>
  );
}

// ---------- Multi-step responder sheet ----------
function PerspectiveSheet({ postId, onClose }: { postId: string; onClose: () => void }) {
  const startFn = useServerFn(startPerspective);
  const verifyFn = useServerFn(submitStandingFacts);
  const submitFn = useServerFn(submitPerspectiveResponse);

  const [step, setStep] = useState<"role" | "verify" | "respond" | "denied">("role");
  const [role, setRole] = useState<Role | null>(null);
  const [perspectiveId, setPerspectiveId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [fact1, setFact1] = useState("");
  const [fact2, setFact2] = useState("");
  const [fact3, setFact3] = useState("");
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);

  const chooseRole = async (r: Role) => {
    setBusy(true);
    try {
      const { perspective_id } = await startFn({ data: { post_id: postId, role: r } });
      setRole(r);
      setPerspectiveId(perspective_id);
      setStep("verify");
    } catch (e) {
      toast.error((e as Error).message === "plaintiff_cannot_respond"
        ? "You filed this case. You cannot respond to yourself."
        : "The court cannot accept that.");
    } finally { setBusy(false); }
  };

  const submitVerify = async () => {
    if (!perspectiveId) return;
    setBusy(true);
    try {
      const { verified } = await verifyFn({
        data: {
          perspective_id: perspectiveId,
          claimed_facts: { claimed_role: name, fact_1: fact1, fact_2: fact2, fact_3: fact3 },
          receipts_urls: [],
        },
      });
      setStep(verified ? "respond" : "denied");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  const submitResponse = async () => {
    if (!perspectiveId) return;
    setBusy(true);
    try {
      await submitFn({ data: { perspective_id: perspectiveId, response_text: response } });
      toast.success("The court has your statement.");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-end sm:place-items-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-background border border-border p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">If you were there, the court will hear you.</h2>
          <button onClick={onClose} className="text-muted-foreground text-xl leading-none">×</button>
        </div>

        {step === "role" && (
          <div className="mt-5 space-y-3">
            {(["named_party","participant","witness"] as Role[]).map((r) => (
              <button
                key={r}
                disabled={busy}
                onClick={() => chooseRole(r)}
                className="w-full text-left rounded-2xl border border-border bg-surface-elevated px-4 py-3 hover:border-primary/50 disabled:opacity-50"
              >
                <div className="font-medium">{ROLE_LABEL[r]}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{ROLE_BENCH[r]}</div>
              </button>
            ))}
          </div>
        )}

        {step === "verify" && role && (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-muted-foreground">
              The court requires proof of standing. Three things only someone present would know.
            </p>
            <Input label="Your role in the story" value={name} onChange={setName} placeholder="e.g. the partner, the friend at the bar" />
            <Input label="Detail one" value={fact1} onChange={setFact1} placeholder="A specific you would know" />
            <Input label="Detail two" value={fact2} onChange={setFact2} placeholder="Another specific" />
            <Input label="Detail three" value={fact3} onChange={setFact3} placeholder="One more" />
            <button
              disabled={busy || !name || !fact1 || !fact2}
              onClick={submitVerify}
              className="w-full rounded-full bg-primary text-primary-foreground py-3 font-medium disabled:opacity-50"
            >
              {busy ? "The bench is reviewing." : "Submit for standing"}
            </button>
          </div>
        )}

        {step === "respond" && (
          <div className="mt-5 space-y-3">
            <p className="text-sm">Standing granted. Speak.</p>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={8}
              placeholder="Your side. Plainly."
              className="w-full rounded-2xl border border-border bg-surface-elevated p-3 text-sm"
            />
            <button
              disabled={busy || response.length < 20}
              onClick={submitResponse}
              className="w-full rounded-full bg-primary text-primary-foreground py-3 font-medium disabled:opacity-50"
            >
              {busy ? "Filing." : "File your perspective"}
            </button>
          </div>
        )}

        {step === "denied" && (
          <div className="mt-5 space-y-3">
            <p className="text-sm">The court is not convinced. You may still watch.</p>
            <button onClick={onClose} className="w-full rounded-full border border-border py-3">
              Step down
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm"
      />
    </label>
  );
}
