// PII Auto-Scrubber
//
// Replaces personally identifying information in user-submitted story text
// with bracketed labels so the story stays coherent but the sensitive
// fragment is gone before we send it to AI providers or persist it.
//
// Safe to import from both client and server — pure string transforms, no IO.

export type PiiKind =
  | "Name"
  | "Phone"
  | "Email"
  | "Address"
  | "Workplace"
  | "School"
  | "Handle"
  | "Plate";

export type ScrubResult = {
  text: string;
  removedKinds: PiiKind[];
  piiRemoved: boolean;
};

// ---------- helpers ----------

const RELATIONSHIP_WORDS = [
  "boyfriend",
  "girlfriend",
  "bf",
  "gf",
  "husband",
  "wife",
  "partner",
  "fiance",
  "fiancé",
  "fiancee",
  "fiancée",
  "ex",
  "ex-boyfriend",
  "ex-girlfriend",
  "ex-husband",
  "ex-wife",
  "boss",
  "manager",
  "coworker",
  "colleague",
  "friend",
  "bestie",
  "best friend",
  "roommate",
  "neighbor",
  "neighbour",
  "mom",
  "mum",
  "mother",
  "dad",
  "father",
  "brother",
  "sister",
  "sibling",
  "son",
  "daughter",
  "cousin",
  "aunt",
  "uncle",
  "grandma",
  "grandpa",
  "grandmother",
  "grandfather",
  "mother-in-law",
  "father-in-law",
  "sister-in-law",
  "brother-in-law",
  "therapist",
  "doctor",
  "lawyer",
  "stepdad",
  "stepmom",
  "stepfather",
  "stepmother",
];

const NAMED_WORDS = ["called", "named"];

const COMPANY_SUFFIX =
  "(?:Inc|LLC|Ltd|Co|Corp|Corporation|Company|Limited|GmbH|S\\.?A\\.?|Pty|Group|Holdings|Studios|Labs|Bank|University|College|Hospital|Clinic|Restaurant|Cafe|Café|Bar|Hotel|Airlines|Airways)";

const SCHOOL_WORDS =
  "(?:Elementary|Primary|Middle|High|Secondary|Prep|Preparatory|Academy|School|College|University|Institute|Kindergarten|Daycare|Nursery)";

// Word-character class kept ASCII-safe for broad regex support.
const NAME_TOKEN = "[A-Z][a-z]+(?:[- ][A-Z][a-z]+)?";

// ---------- patterns ----------

type Rule = { kind: PiiKind; re: RegExp; replace: string | ((m: RegExpExecArray) => string) };

const RULES: Rule[] = [
  // Emails (do first so phones don't grab digits inside emails)
  {
    kind: "Email",
    re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,
    replace: "[Email]",
  },

  // Social handles: @username (3-30 chars, not following a word char so it doesn't match emails)
  {
    kind: "Handle",
    re: /(^|[^\w@])@([a-zA-Z0-9_.]{3,30})\b/g,
    replace: (m) => `${m[1]}[Handle]`,
  },

  // License plates — loose: 2-3 letters then 3-4 digits/letters, or 5-8 char alphanumeric with at least one digit and one letter, typically uppercase.
  {
    kind: "Plate",
    re: /\b(?=[A-Z0-9-]{5,9}\b)(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z]{1,4}[-\s]?[A-Z0-9]{2,5}\b/g,
    replace: "[Plate]",
  },

  // Phone numbers — international or local, 7+ digits, common separators.
  // Require either a leading + or 3+ digit groups so we don't grab plain years.
  {
    kind: "Phone",
    re: /(?:(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\d{2,4}[\s.-]){2,}\d{2,4})/g,
    replace: (m) => {
      const digits = m[0].replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 15 ? "[Phone]" : m[0];
    },
  },

  // Zip / postal codes (US 5(+4), UK, Canada)
  {
    kind: "Address",
    re: /\b(?:\d{5}(?:-\d{4})?|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}|[A-Z]\d[A-Z]\s?\d[A-Z]\d)\b/g,
    replace: "[Address]",
  },

  // Street addresses: "123 Main Street", "45 Park Ave", etc.
  {
    kind: "Address",
    re: /\b\d{1,5}\s+(?:[A-Z][a-zA-Z.]*\s+){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl|Way|Highway|Hwy|Parkway|Pkwy|Terrace|Ter|Square|Sq)\.?\b/g,
    replace: "[Address]",
  },

  // School names: "Lincoln Elementary", "Roosevelt High School"
  {
    kind: "School",
    re: new RegExp(`\\b(?:${NAME_TOKEN}\\s+){1,3}${SCHOOL_WORDS}\\b`, "g"),
    replace: "[School]",
  },

  // Workplace + location: "Acme Corp in Chicago", "Google in Mountain View", "works at Starbucks in Brooklyn"
  {
    kind: "Workplace",
    re: new RegExp(
      `\\b(?:works?\\s+(?:at|for)\\s+|employed\\s+(?:at|by)\\s+|job\\s+at\\s+)?` +
        `(?:${NAME_TOKEN}\\s+)?${NAME_TOKEN}\\s+(?:${COMPANY_SUFFIX})\\b(?:\\s+in\\s+${NAME_TOKEN})?`,
      "g",
    ),
    replace: "[Workplace]",
  },

  // "works at X in Y" without explicit company suffix
  {
    kind: "Workplace",
    re: new RegExp(
      `\\bworks?\\s+(?:at|for)\\s+(${NAME_TOKEN}(?:\\s+${NAME_TOKEN})?)\\s+in\\s+${NAME_TOKEN}\\b`,
      "g",
    ),
    replace: "works at [Workplace]",
  },

  // Names with relationship context: "my boyfriend Jake", "her sister Emma Lee"
  {
    kind: "Name",
    re: new RegExp(
      `\\b((?:my|her|his|their|our|the)\\s+(?:${RELATIONSHIP_WORDS.join("|")}))\\s+(${NAME_TOKEN})\\b`,
      "gi",
    ),
    replace: (m) => `${m[1]} [Name]`,
  },

  // "called Jake" / "named Sarah Smith"
  {
    kind: "Name",
    re: new RegExp(`\\b(${NAMED_WORDS.join("|")})\\s+(${NAME_TOKEN})\\b`, "gi"),
    replace: (m) => `${m[1]} [Name]`,
  },
];

// ---------- scrubPII ----------

export function scrubPII(text: string): ScrubResult {
  if (!text) return { text: text ?? "", removedKinds: [], piiRemoved: false };

  let working = text;
  const kinds = new Set<PiiKind>();

  for (const rule of RULES) {
    // Reset regex state (g flag carries lastIndex across calls)
    rule.re.lastIndex = 0;
    working = working.replace(rule.re, (...args: unknown[]) => {
      const match = args[0] as string;
      // build pseudo-match array for replace callbacks
      const groups = args.slice(1, -2) as string[];
      const exec = Object.assign([match, ...groups], {
        index: args[args.length - 2] as number,
        input: args[args.length - 1] as string,
      }) as unknown as RegExpExecArray;

      const replaced =
        typeof rule.replace === "function" ? rule.replace(exec) : rule.replace;
      if (replaced !== match) kinds.add(rule.kind);
      return replaced;
    });
  }

  const removedKinds = Array.from(kinds);
  return {
    text: working,
    removedKinds,
    piiRemoved: removedKinds.length > 0,
  };
}
