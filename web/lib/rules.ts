// The contract's own numbers, words and door checks, copied from contracts/found_it.py and nowhere
// else: tests/unit/interface.test.mjs reads the contract and fails on any drift. Pure, with no React and
// no network, so node, the server and the in-memory contract of mock mode all use it.

export const GEN = 10n ** 18n;
export const MIN_REWARD = GEN / 20n;
export const MAX_REWARD = 50n * GEN;
export const CLAIM_BOND = GEN / 50n;
export const CLAIMS_PER_FINDER = 2;
export const MIN_TITLE = 3;
export const MAX_TITLE = 80;
export const MIN_PUBLIC = 20;
export const MAX_PUBLIC = 300;
export const MIN_DESCRIPTION = 20;
export const MAX_DESCRIPTION = 500;
export const MIN_MARKS = 20;
export const MAX_MARKS = 500;
export const MIN_SALT = 16;
export const MAX_SALT = 64;
export const DIGEST_CHARS = 64;
export const MIN_REVEAL = 600;
export const MAX_REVEAL = 7 * 86400;
export const MIN_CLAIM_AHEAD = 600;
export const MAX_CLAIM_AHEAD = 365 * 86400;
export const PAGE = 20;
export const MAX_ID_DIGITS = 9;
export const MAX_ARG = 64;

export const STATUSES = ["open", "claimed", "exposed", "returned", "withdrawn"] as const;
export type ItemStatus = (typeof STATUSES)[number];

export const FINDINGS = ["match", "no_match", "unclear"] as const;
export type JudgedFinding = (typeof FINDINGS)[number];
/** The stored finding of a settled claim: the three the validators can agree on, or default. "" while pending. */
export type Finding = JudgedFinding | "default" | "";

/** Where a settled claim's bond went: back to the finder's credit, or paid to the owner. */
export type BondTo = "credit" | "owner" | "";

/** The four questions, word for word. */
export const QUESTION_NAMES_TWO = "Does the FINDER'S DESCRIPTION correctly name at least two of the HIDDEN MARKS? Answer yes, no or unclear.";
export const QUESTION_NOTHING_WRONG = "Is the FINDER'S DESCRIPTION free of any statement that contradicts the HIDDEN MARKS? Answer yes, no or unclear.";
export const QUESTION_FEWER = "Does the FINDER'S DESCRIPTION correctly name fewer than two of the HIDDEN MARKS? Answer yes, no or unclear.";
export const QUESTION_SOMETHING_WRONG = "Does the FINDER'S DESCRIPTION contain a statement that contradicts the HIDDEN MARKS? Answer yes, no or unclear.";

/** What the contract tells every model, before the blocks, about what a named mark and a contradiction are. */
export const SCOPE =
  'A hidden mark is correctly named only when the FINDER\'S DESCRIPTION states that mark specifically: the same thing, with the colour, words, name, damage or place the HIDDEN MARKS give it, in any words. A description that says only something general, such as "a bag", "some stuff inside", "a tag" or "a bottle", names no mark. A statement contradicts the HIDDEN MARKS when both cannot be true of the same item, such as other words on the same tag or another name on the same card. A detail the HIDDEN MARKS do not mention neither names a mark nor contradicts one. Judge only how the FINDER\'S DESCRIPTION relates to the HIDDEN MARKS: not whether the item exists, not who should have it, and not how well either text is written.';

/** The contract's own reason for each settled finding, word for word (its WHY table). */
export const WHY: Record<Exclude<Finding, "">, string> = {
  match:
    "both framings, with either text shown first, found that the description names at least two of the hidden marks and contradicts none, so the reward went to the finder and the bond back to the finder's credit in the same call",
  no_match:
    "both framings, with either text shown first, found that the description names fewer than two of the hidden marks or contradicts one, so the bond went to the owner; the marks are public now, and the item takes claims again once its owner seals new ones",
  unclear:
    "the four askings did not settle the description either way, so the bond went back to the finder's credit and no reward was paid; the marks are public now, and the item takes claims again once its owner seals new ones",
  default:
    "the owner did not reveal the hidden marks within the reveal window, so the claim was paid the reward as if it matched, and the bond went back to the finder's credit: hiding the marks saves the owner nothing",
};

// ---- the contract's readers, mirrored --------------------------------------------------------------

/** Python's str.strip() whitespace: what the contract trims before it measures a text. */
const PY_SPACE = "\t\n\u000b\u000c\r\u001c\u001d\u001e\u001f \u0085                 　";

export function pyStrip(s: string): string {
  let a = 0;
  let b = s.length;
  while (a < b && PY_SPACE.includes(s[a])) a++;
  while (b > a && PY_SPACE.includes(s[b - 1])) b--;
  return s.slice(a, b);
}

/** Python's len(): code points, not UTF-16 units. */
export const pyLen = (s: string): number => Array.from(s).length;

/** _text_problem: "" when the text may be stored and judged, else the contract's own sentence. */
export function textProblem(raw: unknown, least: number, most: number, what: string): string {
  if (typeof raw !== "string") return what + " must be text";
  if (pyLen(raw) > most) return `${what} is ${least} to ${most} characters; this one is ${pyLen(raw)}`;
  const text = pyStrip(raw);
  if (pyLen(text) < least) return `${what} is ${least} to ${most} characters; this one is ${pyLen(text)}`;
  for (const ch of raw) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 32 || c > 126) return what + " is printable ASCII on one line";
  }
  return "";
}

export const titleProblem = (raw: string) => textProblem(raw, MIN_TITLE, MAX_TITLE, "the title");
export const publicProblem = (raw: string) => textProblem(raw, MIN_PUBLIC, MAX_PUBLIC, "the public description");
export const descriptionProblem = (raw: string) => textProblem(raw, MIN_DESCRIPTION, MAX_DESCRIPTION, "the description");
export const marksProblem = (raw: string) => textProblem(raw, MIN_MARKS, MAX_MARKS, "the text of the hidden marks");

const HEX = /^[0-9a-f]+$/;
const ALNUM = /^[0-9A-Za-z]+$/;

/** _digest_of: a seal as the contract stores it, 64 lower-case hex characters, or "". */
export function digestOf(raw: unknown): string {
  if (typeof raw !== "string" || raw.length > DIGEST_CHARS + 16) return "";
  const s = pyStrip(raw).toLowerCase();
  return s.length === DIGEST_CHARS && HEX.test(s) ? s : "";
}

/** _is_salt: 16 to 64 ASCII letters and digits. */
export const isSalt = (raw: unknown): boolean => typeof raw === "string" && raw.length >= MIN_SALT && raw.length <= MAX_SALT && ALNUM.test(raw);

/** _whole: a non-negative whole number from an int or a string of ASCII digits, or -1. */
export function whole(raw: unknown): number {
  if (typeof raw === "boolean") return -1;
  if (typeof raw === "number") return Number.isInteger(raw) && raw >= 0 ? raw : -1;
  if (typeof raw === "bigint") return raw >= 0n ? Number(raw) : -1;
  if (typeof raw === "string") {
    const s = pyStrip(raw);
    if (s && s.length <= 40 && /^[0-9]+$/.test(s)) return Number(s);
  }
  return -1;
}

/** The same, for amounts: an exact bigint, or -1n. */
export function wholeAtto(raw: unknown): bigint {
  if (typeof raw === "boolean") return -1n;
  if (typeof raw === "bigint") return raw >= 0n ? raw : -1n;
  if (typeof raw === "number") return Number.isInteger(raw) && raw >= 0 ? BigInt(raw) : -1n;
  if (typeof raw === "string") {
    const s = pyStrip(raw);
    if (s && s.length <= 40 && /^[0-9]+$/.test(s)) return BigInt(s);
  }
  return -1n;
}

/** _is_id: the prefix, then 1 to 9 ASCII digits with no leading zero. */
export function isId(text: string, prefix: string): boolean {
  const digits = text.slice(1);
  return text.startsWith(prefix) && digits.length >= 1 && digits.length <= MAX_ID_DIGITS && digits[0] !== "0" && /^[0-9]+$/.test(digits);
}

/** _id_of: an id argument trimmed, or "" for anything that is not short text. */
export const idOf = (raw: unknown): string => (typeof raw === "string" && raw.length <= MAX_ARG ? pyStrip(raw) : "");

/** An item id from a URL or a form: "L7" from "L7", "l7" or "7"; "" for anything else. */
export function parseItemId(raw: string): string {
  const m = /^L?([1-9]\d{0,8})$/i.exec(String(raw ?? "").trim());
  return m ? `L${m[1]}` : "";
}

/** The number in an id: 7 for "L7", 0 for anything else. */
export const idNumber = (id: string): number => {
  const m = /^[LC]([1-9]\d{0,8})$/.exec(id);
  return m ? Number(m[1]) : 0;
};

/** A contract sentence as a sentence: a capital first letter and a full stop. */
export function sentence(s: string): string {
  const t = String(s ?? "").trim();
  if (!t) return "";
  const first = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(first) ? first : first + ".";
}
