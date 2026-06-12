// Admin auth server functions. Two-step login: password → TOTP.
// All handlers load server-only modules inside via await import() (route files
// reach this module's top-level via the client graph).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";

const PENDING_HEADER = "x-shutap-admin-pending";
const PENDING_MAX_MS = 5 * 60 * 1000;

function signPending(adminId: string): string {
  // tiny HMAC over adminId|expiry using session seed
  const exp = Date.now() + PENDING_MAX_MS;
  const payload = `${adminId}.${exp}`;
  const sig = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
    .update(payload).digest("hex").slice(0, 32);
  return `${payload}.${sig}`;
}
function verifyPending(token: string): string | null {
  const { createHmac, timingSafeEqual } = require("node:crypto") as typeof import("node:crypto");
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [adminId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  const expected = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
    .update(`${adminId}.${expStr}`).digest("hex").slice(0, 32);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return adminId;
}

/** Step 1: verify email + password. Returns a short-lived pending token to use with TOTP. */
export const adminPasswordStep = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      email: z.string().email().max(255),
      password: z.string().min(1).max(200),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyPassword } = await import("./password.server");
    const email = data.email.trim().toLowerCase();
    const { data: row } = await supabaseAdmin
      .from("admin_users")
      .select("id, password_hash, active")
      .eq("email", email)
      .maybeSingle();
    // Constant-ish-time: always run scrypt
    const dummy = "scrypt$16384$8$1$00$00";
    const ok = row?.active && verifyPassword(data.password, (row as any).password_hash);
    if (!ok) {
      // burn cycles to avoid easy timing oracle
      if (!row) verifyPassword(data.password, dummy);
      const err: any = new Error("invalid_credentials");
      err.statusCode = 401;
      throw err;
    }
    return { pending: signPending((row as any).id) };
  });

/** Step 2: verify TOTP, mint the admin session cookie. */
export const adminTotpStep = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ pending: z.string().min(10), code: z.string().regex(/^\d{6}$/) }).parse(i),
  )
  .handler(async ({ data }) => {
    const adminId = verifyPending(data.pending);
    if (!adminId) {
      const err: any = new Error("pending_expired");
      err.statusCode = 401;
      throw err;
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("admin_users")
      .select("id, email, display_name, role, totp_secret, active")
      .eq("id", adminId)
      .maybeSingle();
    if (!row || !(row as any).active) {
      const err: any = new Error("invalid_admin");
      err.statusCode = 401;
      throw err;
    }
    const otplib = await import("otplib");
    const result = otplib.verifySync({
      strategy: "totp",
      secret: (row as any).totp_secret,
      token: data.code,
      window: 1,
    } as any);
    if (!result?.valid) {
      const err: any = new Error("invalid_code");
      err.statusCode = 401;
      throw err;
    }
    const { getAdminSessionManager } = await import("./session.server");
    const session = await getAdminSessionManager();
    const now = Date.now();
    await session.update({
      adminId: (row as any).id,
      email: (row as any).email,
      displayName: (row as any).display_name,
      role: (row as any).role,
      loginAt: now,
      lastActiveAt: now,
    });
    await supabaseAdmin.from("admin_users")
      .update({ last_login_at: new Date().toISOString(), last_active_at: new Date().toISOString() })
      .eq("id", (row as any).id);
    return { ok: true, role: (row as any).role as string, displayName: (row as any).display_name as string };
  });

export const adminLogout = createServerFn({ method: "POST" })
  .handler(async () => {
    const { getAdminSessionManager } = await import("./session.server");
    const session = await getAdminSessionManager();
    await session.clear();
    return { ok: true };
  });

export const getAdminMe = createServerFn({ method: "GET" })
  .handler(async () => {
    const { readAdminSession } = await import("./session.server");
    const s = await readAdminSession();
    if (!s) return null;
    return { adminId: s.adminId, email: s.email, displayName: s.displayName, role: s.role };
  });

/** Bootstrap: create the very first super_admin when admin_users is empty.
 *  Returns the TOTP otpauth URL and base32 secret to scan into an authenticator. */
export const adminBootstrap = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      email: z.string().email().max(255),
      displayName: z.string().min(1).max(80),
      password: z.string().min(12).max(200),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: cErr } = await supabaseAdmin
      .from("admin_users").select("*", { count: "exact", head: true });
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0) {
      const err: any = new Error("bootstrap_closed");
      err.statusCode = 403;
      throw err;
    }
    const otplib = await import("otplib");
    const secret = otplib.generateSecret();
    const { hashPassword } = await import("./password.server");
    const email = data.email.trim().toLowerCase();
    const { error } = await supabaseAdmin.from("admin_users").insert({
      email,
      display_name: data.displayName,
      password_hash: hashPassword(data.password),
      totp_secret: secret,
      role: "super_admin",
      active: true,
    });
    if (error) throw new Error(error.message);
    const otpauth = otplib.generateURI({ strategy: "totp", issuer: "Shutap Bench", label: email, secret });
    return { otpauth, secret };
  });

/** Allows the login form to know whether to show bootstrap UI. */
export const adminBootstrapAvailable = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("admin_users").select("*", { count: "exact", head: true });
    return { available: (count ?? 0) === 0 };
  });

export type AdminRoleClient = "super_admin" | "moderator" | "analyst" | "partner_manager";
