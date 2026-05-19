// Pure helpers for @handle validation, shared by client + server.
export const HANDLE_RE = /^[a-z0-9_]{3,24}$/;

export function slugifyHandle(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

export function validateHandle(handle: string): { ok: boolean; message?: string } {
  if (!handle) return { ok: false, message: "type a handle" };
  if (handle.length < 3) return { ok: false, message: "too short (min 3)" };
  if (handle.length > 24) return { ok: false, message: "too long (max 24)" };
  if (!HANDLE_RE.test(handle))
    return { ok: false, message: "lowercase letters, numbers, _ only" };
  return { ok: true };
}
