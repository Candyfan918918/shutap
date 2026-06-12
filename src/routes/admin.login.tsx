// /admin/login — two-step (password → TOTP). Bootstrap form when no admins exist.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  adminBootstrap,
  adminBootstrapAvailable,
  adminPasswordStep,
  adminTotpStep,
} from "@/lib/admin/auth.functions";

export const Route = createFileRoute("/admin/login")({
  ssr: false,
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const passwordStep = useServerFn(adminPasswordStep);
  const totpStep = useServerFn(adminTotpStep);
  const bootstrapCheck = useServerFn(adminBootstrapAvailable);
  const bootstrap = useServerFn(adminBootstrap);

  const [phase, setPhase] = useState<"password" | "totp" | "bootstrap" | "bootstrap-done">("password");
  const [bootstrapAvailable, setBootstrapAvailable] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bootstrapResult, setBootstrapResult] = useState<{ otpauth: string; secret: string } | null>(null);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    bootstrapCheck({}).then((r) => setBootstrapAvailable(r.available));
  }, [bootstrapCheck]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[oklch(0.14_0.01_270)] text-zinc-200 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Shutap</div>
          <div className="text-lg font-medium text-zinc-100">The Bench · Admin</div>
        </div>

        {phase === "password" && (
          <form
            className="space-y-3 rounded border border-zinc-800 bg-[oklch(0.18_0.01_270)] p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true); setErr(null);
              try {
                const res = await passwordStep({ data: { email, password } });
                setPending(res.pending);
                setPhase("totp");
              } catch (e: any) {
                setErr(e?.message === "invalid_credentials" ? "Credentials rejected." : "Login failed.");
              } finally { setBusy(false); }
            }}
          >
            <label className="block text-xs text-zinc-400">Email
              <input
                type="email" autoComplete="username" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full bg-[oklch(0.14_0.01_270)] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600"
              />
            </label>
            <label className="block text-xs text-zinc-400">Password
              <input
                type="password" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full bg-[oklch(0.14_0.01_270)] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600"
              />
            </label>
            {err && <div className="text-xs text-rose-400">{err}</div>}
            <button
              type="submit" disabled={busy}
              className="w-full rounded bg-zinc-100 text-zinc-900 text-sm font-medium px-3 py-2 hover:bg-white disabled:opacity-50"
            >
              {busy ? "Checking." : "Get verification code"}
            </button>
            {bootstrapAvailable && (
              <button
                type="button"
                onClick={() => setPhase("bootstrap")}
                className="w-full text-xs text-zinc-500 hover:text-zinc-300"
              >
                No admins exist yet — bootstrap first super_admin
              </button>
            )}
          </form>
        )}

        {phase === "totp" && (
          <form
            className="space-y-3 rounded border border-zinc-800 bg-[oklch(0.18_0.01_270)] p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!pending) return;
              setBusy(true); setErr(null);
              try {
                await totpStep({ data: { pending, code } });
                navigate({ to: "/admin" });
              } catch (e: any) {
                setErr(
                  e?.message === "invalid_code" ? "Code rejected." :
                  e?.message === "pending_expired" ? "Step expired. Start over." :
                  "Verification failed.",
                );
              } finally { setBusy(false); }
            }}
          >
            <div className="text-xs text-zinc-400">Enter the 6-digit code from your authenticator.</div>
            <input
              inputMode="numeric" pattern="\d{6}" maxLength={6} required autoFocus
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full bg-[oklch(0.14_0.01_270)] border border-zinc-800 rounded px-3 py-2 text-center text-xl tracking-[0.4em] tabular-nums text-zinc-100 focus:outline-none focus:border-zinc-600"
            />
            {err && <div className="text-xs text-rose-400">{err}</div>}
            <button
              type="submit" disabled={busy || code.length !== 6}
              className="w-full rounded bg-zinc-100 text-zinc-900 text-sm font-medium px-3 py-2 hover:bg-white disabled:opacity-50"
            >
              {busy ? "Verifying." : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => { setPhase("password"); setPending(null); setCode(""); }}
              className="w-full text-xs text-zinc-500 hover:text-zinc-300"
            >
              Back
            </button>
          </form>
        )}

        {phase === "bootstrap" && (
          <form
            className="space-y-3 rounded border border-zinc-800 bg-[oklch(0.18_0.01_270)] p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true); setErr(null);
              try {
                const r = await bootstrap({ data: { email, password, displayName } });
                setBootstrapResult(r);
                setPhase("bootstrap-done");
              } catch (e: any) {
                setErr(e?.message === "bootstrap_closed" ? "An admin already exists." : "Bootstrap failed.");
              } finally { setBusy(false); }
            }}
          >
            <div className="text-xs text-zinc-400">First super_admin. This form disappears once one exists.</div>
            <input
              type="text" placeholder="Display name" required
              value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-[oklch(0.14_0.01_270)] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100"
            />
            <input
              type="email" placeholder="Email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[oklch(0.14_0.01_270)] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100"
            />
            <input
              type="password" placeholder="Password (min 12 chars)" required minLength={12}
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[oklch(0.14_0.01_270)] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100"
            />
            {err && <div className="text-xs text-rose-400">{err}</div>}
            <button
              type="submit" disabled={busy}
              className="w-full rounded bg-zinc-100 text-zinc-900 text-sm font-medium px-3 py-2 disabled:opacity-50"
            >
              {busy ? "Creating." : "Create super_admin"}
            </button>
            <button type="button" onClick={() => setPhase("password")} className="w-full text-xs text-zinc-500">
              Back
            </button>
          </form>
        )}

        {phase === "bootstrap-done" && bootstrapResult && (
          <div className="space-y-3 rounded border border-zinc-800 bg-[oklch(0.18_0.01_270)] p-4">
            <div className="text-sm text-zinc-100">Admin created.</div>
            <div className="text-xs text-zinc-400">
              Scan this QR with your authenticator app, then sign in. Shown once.
            </div>
            <div className="flex justify-center rounded bg-white p-3">
              <QRCodeSVG value={bootstrapResult.otpauth} size={192} level="M" />
            </div>
            <div className="text-[11px] text-zinc-500">
              Manual entry secret:{" "}
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(bootstrapResult.secret)}
                className="text-zinc-300 underline decoration-dotted hover:text-zinc-100"
                title="Copy"
              >
                {bootstrapResult.secret}
              </button>
            </div>
            <code className="block break-all rounded bg-[oklch(0.14_0.01_270)] border border-zinc-800 px-2 py-2 text-[10px] text-zinc-400">
              {bootstrapResult.otpauth}
            </code>
            <button
              type="button"
              onClick={() => { setPhase("password"); setPassword(""); setBootstrapResult(null); setBootstrapAvailable(false); }}
              className="w-full rounded bg-zinc-100 text-zinc-900 text-sm font-medium px-3 py-2"
            >
              Continue to login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
