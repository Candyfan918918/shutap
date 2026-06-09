// First-session lifecycle — a short-lived flag in sessionStorage that survives
// the immediate post-claim navigation but resets on tab close. The flag also
// carries the alias for the welcome line and the entry post id so the
// curated stream can render the just-acted-on case first.
const KEY = "shutap.firstSession";

export interface FirstSessionMeta {
  /** Full alias line — "🇧🇷 Heartbroken Octopus" (display ready). */
  aliasLine?: string;
  /** Post the user acted on right before the ceremony, if any. */
  entryPostId?: string;
  /** Pending action type so the stream can highlight the right slot. */
  entryAction?: string;
  /** Timestamp set when the flag was created. */
  startedAt: number;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes

export function markFirstSession(meta: Omit<FirstSessionMeta, "startedAt">) {
  if (typeof window === "undefined") return;
  try {
    const payload: FirstSessionMeta = { ...meta, startedAt: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function readFirstSession(): FirstSessionMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FirstSessionMeta;
    if (!parsed.startedAt || Date.now() - parsed.startedAt > TTL_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearFirstSession() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
