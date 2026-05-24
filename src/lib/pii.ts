// Lightweight client-side PII / doxxing heuristic. Not a security boundary —
// just a "hey, this looks like personal info" nudge before publish.

export type PiiHit = { kind: "email" | "phone" | "handle" | "url"; sample: string };

const PATTERNS: Array<{ kind: PiiHit["kind"]; re: RegExp }> = [
  { kind: "email", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  // E.164 / loose phone: 7-15 digits, optional separators
  { kind: "phone", re: /(?:\+?\d[\s().-]?){7,15}/g },
  { kind: "handle", re: /(?<![\w])@[a-zA-Z0-9_.]{3,30}\b/g },
  { kind: "url", re: /\b(?:https?:\/\/|www\.)\S{4,}/gi },
];

export function scanPii(text: string): PiiHit[] {
  const hits: PiiHit[] = [];
  for (const { kind, re } of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const sample = m[0];
      // phone false-positive guard: require at least 7 digits
      if (kind === "phone" && (sample.match(/\d/g)?.length ?? 0) < 7) continue;
      hits.push({ kind, sample: sample.length > 40 ? sample.slice(0, 37) + "…" : sample });
    }
  }
  return hits;
}
