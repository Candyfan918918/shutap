// Web Share API helpers — native share sheet with the share-card PNG attached.
import type { ShareCardFormat } from "@/lib/share/card-svg";

export function shareCardUrl(postId: string, format: ShareCardFormat = "square", origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/api/public/share-card/${postId}?format=${format}`;
}

export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export function canShareFiles(files: File[]): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files })
  );
}

export async function fetchShareCardFile(
  postId: string,
  format: ShareCardFormat = "square",
): Promise<File> {
  const url = shareCardUrl(postId, format);
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`Failed to load share card (${res.status})`);
  const blob = await res.blob();
  return new File([blob], `marriage-drama-${postId}.png`, {
    type: blob.type || "image/png",
  });
}

export interface NativeShareInput {
  postId: string;
  title: string;
  text: string;
  url: string;
  format?: ShareCardFormat;
}

export type NativeShareResult =
  | { ok: true; withFile: boolean }
  | { ok: false; reason: "unsupported" | "cancelled" | "error"; error?: unknown };

export async function nativeShareCard(input: NativeShareInput): Promise<NativeShareResult> {
  if (!canNativeShare()) return { ok: false, reason: "unsupported" };

  // Try with file first
  try {
    const file = await fetchShareCardFile(input.postId, input.format);
    if (canShareFiles([file])) {
      try {
        await navigator.share({
          files: [file],
          title: input.title,
          text: input.text,
          url: input.url,
        });
        return { ok: true, withFile: true };
      } catch (err) {
        if (isAbortError(err)) return { ok: false, reason: "cancelled" };
        // fall through to text-only share
      }
    }
  } catch {
    // image fetch failed — fall through to text-only share
  }

  try {
    await navigator.share({ title: input.title, text: input.text, url: input.url });
    return { ok: true, withFile: false };
  } catch (err) {
    if (isAbortError(err)) return { ok: false, reason: "cancelled" };
    return { ok: false, reason: "error", error: err };
  }
}

export async function downloadShareCard(
  postId: string,
  format: ShareCardFormat = "square",
): Promise<void> {
  const file = await fetchShareCardFile(postId, format);
  const blobUrl = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
