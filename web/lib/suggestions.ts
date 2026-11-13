// One-click suggestions for every field a visitor fills in. Each chip fills its field with a value the
// contract accepts (tests/unit/suggestions.test.mjs checks every one against the contract's limits).
// The first set of marks is the one the demo finder's accurate line names, so a visitor who posts it can
// watch a match from the owner's side.

import { LOST_MARKS_FIRST } from "./demo-items.ts";
import { GEN } from "./rules.ts";

export type Chip<T> = { label: string; value: T; note?: string };

export const TITLE_CHIPS: Chip<string>[] = [
  { label: "Wallet", value: "Brown leather wallet, Quay Road tram" },
  { label: "Keys", value: "House keys on a blue lanyard, Ferry Pier" },
  { label: "Camera", value: "Small silver camera, Lowbridge Market" },
];

export const PUBLIC_CHIPS: Chip<string>[] = [
  { label: "Tram", value: "A brown leather wallet left on a seat of the Quay Road tram towards the ferry, on Tuesday afternoon." },
  { label: "Pier", value: "A set of house keys dropped near the ticket office at the Ferry Pier, some time on Saturday morning." },
  { label: "Market", value: "A small silver camera in a grey pouch, left at a fruit stall at Lowbridge Market on Sunday." },
];

export const MARKS_CHIPS: Chip<string>[] = [
  { label: "Card, key, receipt", value: LOST_MARKS_FIRST, note: "the demo finder's accurate line names two of these" },
  { label: "Photo, pass, flap", value: "a photo of a grey cat tucked behind the bank card; a bus pass for Rhea Lund; a torn corner on the coin flap" },
  { label: "Strap, scratch, card", value: "a strap knotted twice near the lens; a long scratch across the screen; a memory card labelled HOLIDAY 3 in the slot" },
];

export const REWARD_CHIPS: Chip<bigint>[] = [
  { label: "0.05 GEN", value: GEN / 20n, note: "the least" },
  { label: "0.1 GEN", value: GEN / 10n },
  { label: "0.25 GEN", value: GEN / 4n },
  { label: "1 GEN", value: GEN },
];

export const REVEAL_CHIPS: Chip<number>[] = [
  { label: "10 minutes", value: 600, note: "the shortest" },
  { label: "1 hour", value: 3600 },
  { label: "1 day", value: 86400 },
];

/** Claims close this many seconds after the post. */
export const CLAIM_AHEAD_CHIPS: Chip<number>[] = [
  { label: "1 hour", value: 3600 },
  { label: "1 week", value: 7 * 86400 },
  { label: "30 days", value: 30 * 86400 },
];

export const DEPOSIT_CHIPS: Chip<bigint>[] = [
  { label: "0.02 GEN", value: GEN / 50n, note: "one bond" },
  { label: "0.04 GEN", value: GEN / 25n, note: "two bonds" },
  { label: "0.1 GEN", value: GEN / 10n },
];
