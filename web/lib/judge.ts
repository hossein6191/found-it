// How the in-memory contract of mock mode stands in for the validators. It cannot ask a model, so it
// counts words: a mark is named when every word the mark set lists for it appears in the description,
// half-named when only some do, and a listed contradicting word settles the claim against the finder.
// Two marks named and nothing contradicted is a match; two marks at least half-named is unclear, the
// way four readings that do not agree land on unclear; anything else is no_match. For marks it has no
// list for (a visitor's own), it takes the longer words of each mark as its list and knows no
// contradictions. On chain every validator reads both texts with its own model instead, in both
// framings and both orders, and only a finding they agree on exactly moves money.

import { DEMO_ITEMS, LOST_MARKS_SET, type MarkSet } from "./demo-items.ts";
import type { JudgedFinding } from "./rules.ts";

const STOP = new Set(
  "with from that this there their which where what when into onto over under near inside outside about other some side once only also have been were they them then than very just like across along behind beside between round around".split(" "),
);

const KNOWN: MarkSet[] = [...DEMO_ITEMS.flatMap((d) => d.sets), LOST_MARKS_SET];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when `term` appears in the lower-cased text: a phrase or a short word whole, a longer word as a word start. */
export function hasTerm(text: string, term: string): boolean {
  const t = term.toLowerCase();
  const re = t.includes(" ") || t.length < 4 ? new RegExp(`(^|[^a-z0-9])${esc(t)}($|[^a-z0-9])`) : new RegExp(`(^|[^a-z0-9])${esc(t)}`);
  return re.test(text.toLowerCase());
}

/** The word lists of marks the mock has none for: each mark's longer words. */
export function derivedTerms(marks: string): string[][] {
  let parts = marks.split(";").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) parts = marks.split(/,| and /).map((p) => p.trim()).filter(Boolean);
  return parts
    .map((p) =>
      Array.from(new Set((p.toLowerCase().match(/[a-z0-9.]+/g) ?? []).filter((w) => (w.length >= 4 && !STOP.has(w)) || /\d/.test(w)))),
    )
    .filter((ws) => ws.length > 0);
}

export function judgeByWords(marks: string, description: string): JudgedFinding {
  const known = KNOWN.find((s) => s.marks === marks);
  const terms = known ? known.terms : derivedTerms(marks);
  const against = known ? known.against : [];
  if (against.some((w) => hasTerm(description, w))) return "no_match";
  let named = 0;
  let half = 0;
  for (const list of terms) {
    const present = list.filter((w) => hasTerm(description, w)).length;
    const needed = known ? list.length : Math.max(1, Math.ceil((list.length * 2) / 3));
    if (present >= needed) named++;
    else if (present > 0) half++;
  }
  if (named >= 2) return "match";
  if (named + half >= 2) return "unclear";
  return "no_match";
}
