// Admin session config + helpers. httpOnly encrypted cookie via @tanstack/react-start/server.
// Server-only — never import from client modules.
import { createHash } from "node:crypto";
import { useSession } from "@tanstack/react-start/server";

export type AdminRole = "super_admin" | "moderator" | "analyst" | "partner_manager";

export interface AdminSessionData {
  adminId: string;
  email: string;
  displayName: string;
  role: AdminRole;
  loginAt: number;     // ms epoch
  lastActiveAt: number; // ms epoch
}

const INACTIVITY_MS = 4 * 60 * 60 * 1000; // 4 hours

function sessionPassword(): string {
  const src = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!src) throw new Error("missing_session_seed");
  return createHash("sha256").update(src + ":shutap-admin-session-v1").digest("hex");
}

export function sessionConfig() {
  return {
    password: sessionPassword(),
    name: "shutap_admin_session",
    maxAge: 60 * 60 * 24, // hard cap 24h; inactivity check happens in code
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/admin",
    },
  };
}

/** Returns the live session manager (read, update, clear). */
export async function getAdminSessionManager() {
  return useSession<AdminSessionData>(sessionConfig());
}

/** Read + validate session. Returns null if missing or expired. Refreshes lastActiveAt on hit. */
export async function readAdminSession(): Promise<AdminSessionData | null> {
  const session = await getAdminSessionManager();
  const raw = session.data as Partial<AdminSessionData> | undefined;
  if (!raw?.adminId || !raw.email || !raw.displayName || !raw.role || !raw.loginAt || !raw.lastActiveAt) {
    return null;
  }
  const data: AdminSessionData = {
    adminId: raw.adminId,
    email: raw.email,
    displayName: raw.displayName,
    role: raw.role as AdminRole,
    loginAt: raw.loginAt,
    lastActiveAt: raw.lastActiveAt,
  };
  const now = Date.now();
  if (now - data.lastActiveAt > INACTIVITY_MS) {
    await session.clear();
    return null;
  }
  if (now - data.lastActiveAt > 60_000) {
    await session.update({ ...data, lastActiveAt: now });
    data.lastActiveAt = now;
  }
  return data;
}

/** Throw a redirect-style error if the session is missing or lacks one of the allowed roles. */
export async function requireAdminSession(opts?: { roles?: AdminRole[] }): Promise<AdminSessionData> {
  const data = await readAdminSession();
  if (!data) {
    const err: any = new Error("unauthenticated");
    err.statusCode = 401;
    throw err;
  }
  if (opts?.roles && !opts.roles.includes(data.role)) {
    const err: any = new Error("forbidden");
    err.statusCode = 403;
    throw err;
  }
  return data;
}
