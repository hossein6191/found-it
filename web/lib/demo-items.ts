// The demo: three lost items the demo owner keeps on the shelf, and the three fixed lines the demo finder
// claims a visitor's own item with. Pure data and a few pure helpers, shared by the pages, the server bot
// (lib/demo-server.ts), the in-memory contract of mock mode and tools/open-demo.mjs.
//
// Each demo item has a fixed rotation of three sets of hidden marks. Seal number n (1 for the post, 2
// after the first reseal, ...) holds set (n - 1) mod 3, under a salt only the server can make: the
// first 32 hex characters of sha256("found-it demo salt|" + key + "|" + slug + "|" + n). So the bot keeps
// no state at all: from the item's own seals counter it knows which marks it sealed and can open the
// seal again. A real owner must never seal marks that were revealed; the demo goes round its three
// sets because its marks are printed on the finder's page anyway, as the scene of the find.
//
// Every mark set carries the words the in-memory contract of mock mode counts (`terms`, one list per
// mark) and the words that contradict a mark (`against`); on chain every validator reads the text with
// its own model instead. The three description chips of each set are written so the mock reads them as
// the validators should: the accurate one names two marks, the vague one only gestures at two, the
// wrong one contradicts one.

import { CLAIM_BOND, GEN } from "./rules.ts";
import { sha256Hex } from "./seal.ts";

export type DemoSlug = "backpack" | "umbrella" | "scarf";

export type MarkSet = {
  /** the hidden marks exactly as sealed and revealed */
  marks: string;
  /** what the mock counts as naming each mark: every word of a list present names that mark */
  terms: string[][];
  /** words that contradict one of the marks */
  against: string[];
  /** a description that names two marks */
  accurate: string;
  /** one that only gestures at two */
  vague: string;
  /** one that contradicts a mark */
  wrong: string;
};

export type DemoItem = {
  slug: DemoSlug;
  title: string;
  publicDescription: string;
  rewardAtto: bigint;
  revealSeconds: number;
  /** claim_by is this many seconds after the post */
  claimAhead: number;
  /** where it was found, for the scene */
  place: string;
  sets: [MarkSet, MarkSet, MarkSet];
};

const DAY = 86400;

export const DEMO_ITEMS: DemoItem[] = [
  {
    slug: "backpack",
    title: "Navy backpack, number 12 bus",
    publicDescription: "A navy blue backpack left on the top deck of the number 12 bus towards Lowbridge, one evening this week.",
    rewardAtto: (GEN * 12n) / 100n,
    revealSeconds: 600,
    claimAhead: 300 * DAY,
    place: "on the top deck of the number 12 bus",
    sets: [
      {
        marks: "a red luggage tag reading TIDEPOOL; a cracked green water bottle in the side pocket; a folded bus map of Lowbridge in the inner pocket",
        terms: [["red", "tag", "tidepool"], ["green", "bottle", "crack"], ["map", "lowbridge"]],
        against: ["harbour", "ines corrie"],
        accurate: "It has a red tag that says TIDEPOOL, and a green water bottle with a crack in it sits in the side pocket.",
        vague: "A navy backpack with a tag on the strap and a bottle in one of the pockets, I think.",
        wrong: "A red luggage tag reading HARBOUR, and a library card for Ines Corrie in the front pocket.",
      },
      {
        marks: "a broken zip pull tied with yellow string; a heron drawn in marker on the laptop sleeve; two spare buttons sewn inside the lid",
        terms: [["zip", "yellow", "string"], ["heron", "sleeve"], ["buttons", "lid"]],
        against: ["green ribbon", "fox"],
        accurate: "One zip pull is broken and tied up with yellow string, and somebody drew a heron on the laptop sleeve.",
        vague: "A blue bag with a zip on top and a sleeve inside for a laptop.",
        wrong: "The zip pull is tied with green ribbon, and there is a fox drawn on the laptop sleeve.",
      },
      {
        marks: "a Lowbridge Rowing Club patch sewn on the front; a pencil case with a torn corner held by a safety pin; a library card for Mara Quist in the front pocket",
        terms: [["rowing", "patch"], ["pencil", "safety"], ["library", "mara", "quist"]],
        against: ["chess", "ines corrie"],
        accurate: "There is a Lowbridge Rowing Club patch on the front, and a library card for Mara Quist in the front pocket.",
        vague: "A navy backpack with a patch on the front and a pencil somewhere inside.",
        wrong: "There is a chess club patch on the front, and a library card for Ines Corrie inside.",
      },
    ],
  },
  {
    slug: "umbrella",
    title: "Black umbrella, Harbour Library",
    publicDescription: "A long black umbrella with a wooden handle, left by the reading tables on the first floor of Harbour Library.",
    rewardAtto: (GEN * 8n) / 100n,
    revealSeconds: 600,
    claimAhead: 300 * DAY,
    place: "by the reading tables of Harbour Library",
    sets: [
      {
        marks: "the initials JQ carved into the wooden handle; a paper clip bent around one broken rib; a Harbour Library cloakroom ticket, number 41, tucked in the strap",
        terms: [["jq", "carved", "handle"], ["paper clip", "rib"], ["cloakroom", "41"]],
        against: ["mr", "bus ticket"],
        accurate: "The wooden handle has JQ carved into it, and one broken rib is held together with a bent paper clip.",
        vague: "A black umbrella with something on the handle and a rib that is not right.",
        wrong: "The handle has the letters MR carved in it, and the strap holds an old bus ticket.",
      },
      {
        marks: "a strip of yellow tape wound round the tip; a silver button that sticks halfway; the name Odile Brandt written inside the canopy in white pen",
        terms: [["yellow", "tape", "tip"], ["silver", "button", "stick"], ["odile", "brandt", "canopy"]],
        against: ["harriet moss", "red tape"],
        accurate: "Yellow tape is wound round the tip, and the name Odile Brandt is written inside the canopy in white.",
        vague: "A black umbrella with some tape on it and a button to open it.",
        wrong: "Inside the canopy it says Harriet Moss, and the tip is wrapped in red tape.",
      },
      {
        marks: "a cracked amber bead hanging from the wrist loop; three small burn holes near one edge of the canopy; 12.50 written in pencil on the wooden shaft",
        terms: [["amber", "bead", "loop"], ["burn", "holes", "canopy"], ["12.50", "pencil"]],
        against: ["blue glass", "tear"],
        accurate: "A cracked amber bead hangs from the wrist loop, and there are three small burn holes near the edge of the canopy.",
        vague: "It has a bead hanging somewhere and a few holes in it.",
        wrong: "A blue glass bead hangs from the loop, and there is a long tear down the middle of the canopy.",
      },
    ],
  },
  {
    slug: "scarf",
    title: "Green scarf, Tidepool Cafe",
    publicDescription: "A long green wool scarf left over a chair by the window of the Tidepool Cafe on Quay Road.",
    rewardAtto: (GEN * 6n) / 100n,
    revealSeconds: 600,
    claimAhead: 300 * DAY,
    place: "over a chair by the window of the Tidepool Cafe",
    sets: [
      {
        marks: "the letter W stitched in orange thread near one end; a coin-sized burn mark beside the fringe; a loose grey thread knotted three times at the other end",
        terms: [["w", "orange", "thread"], ["burn", "fringe"], ["grey", "knot"]],
        against: ["letter m", "blue thread", "tear"],
        accurate: "Near one end the letter W is stitched in orange thread, and there is a burn mark the size of a coin by the fringe.",
        vague: "A green scarf with some thread hanging off it and a burn somewhere.",
        wrong: "The letter M is stitched in blue thread, and there is a long tear down the middle.",
      },
      {
        marks: "a small brass safety pin through one corner; the fringe cut short at one end only; a darker green stripe where it was once mended",
        terms: [["brass", "pin"], ["fringe", "short"], ["darker", "stripe", "mended"]],
        against: ["silver brooch", "both ends"],
        accurate: "A small brass safety pin goes through one corner, and the fringe is cut short at one end only.",
        vague: "It is a green scarf with a pin in it and a fringe.",
        wrong: "There is a silver brooch on one corner, and the fringe is long at both ends.",
      },
      {
        marks: "a Tidepool Cafe cloakroom ticket, number 7, in the fold; a darned patch of blue wool near the middle; one end wider than the other",
        terms: [["ticket", "cloakroom", "7"], ["darn", "blue", "wool"], ["wider"]],
        against: ["bus ticket", "number 12", "red patch"],
        accurate: "Folded inside was a Tidepool Cafe cloakroom ticket, number 7, and there is a darned patch of blue wool near the middle.",
        vague: "A green scarf with a ticket in it and some darning.",
        wrong: "There is a bus ticket, number 12, in the fold, and a red patch near one end.",
      },
    ],
  },
];

export const DEMO_TITLES = DEMO_ITEMS.map((d) => d.title);

/** The demo item a title belongs to, word for word, or null. */
export const demoOfTitle = (title: string): DemoItem | null => DEMO_ITEMS.find((d) => d.title === title) ?? null;

export const demoOfSlug = (slug: string): DemoItem | null => DEMO_ITEMS.find((d) => d.slug === slug) ?? null;

/** The mark set seal number `seal` holds (1 for the post). */
export const setOfSeal = (d: DemoItem, seal: number): MarkSet => d.sets[(((Math.max(1, Math.trunc(seal)) - 1) % 3) + 3) % 3];

export const DEMO_SALT_PREFIX = "found-it demo salt|";

/** The salt of seal number `seal` of a demo item: only the holder of the key can make it. */
export const demoSalt = (key: string, slug: DemoSlug, seal: number): string => sha256Hex(DEMO_SALT_PREFIX + key + "|" + slug + "|" + Math.trunc(seal)).slice(0, 32);

/** The three description chips of a mark set, in the order the finder's page offers them. */
export const descriptionChips = (set: MarkSet) => [
  { key: "accurate", label: "Names two marks", text: set.accurate, expect: "should match" },
  { key: "vague", label: "Vague", text: set.vague, expect: "should not settle" },
  { key: "wrong", label: "Gets one wrong", text: set.wrong, expect: "should not match" },
];

// ---- the demo finder: three fixed lines for a visitor's own item ------------------------------------

/**
 * The marks the first suggestion on /lost seals. The demo finder's accurate line names two of them; on
 * any other marks every line is simply a description the validators read for what it says.
 */
export const LOST_MARKS_FIRST = "a green library card for Mara Quist behind the clear window; a brass key on a blue lanyard clipped inside; a Tidepool Cafe receipt folded in the coin pocket";

export const LOST_MARKS_SET: MarkSet = {
  marks: LOST_MARKS_FIRST,
  terms: [["library", "mara", "quist"], ["brass", "key", "lanyard"], ["receipt", "coin"]],
  against: ["ines corrie", "silver key", "red lanyard"],
  accurate: "Behind the clear window is a green library card for Mara Quist, and a brass key on a blue lanyard is clipped inside.",
  vague: "There is a card in it and a key on something, and some paper.",
  wrong: "There is a library card for Ines Corrie, and a silver key on a red lanyard.",
};

export type FinderLine = "accurate" | "vague" | "wrong";
export const FINDER_LINES: { key: FinderLine; label: string; text: string; note: string }[] = [
  { key: "accurate", label: "Names two marks", text: LOST_MARKS_SET.accurate, note: "names two of the first suggested marks" },
  { key: "vague", label: "Vague", text: LOST_MARKS_SET.vague, note: "names nothing specific" },
  { key: "wrong", label: "Gets one wrong", text: LOST_MARKS_SET.wrong, note: "contradicts the first suggested marks" },
];
export const isFinderLine = (k: unknown): k is FinderLine => k === "accurate" || k === "vague" || k === "wrong";
export const finderLine = (k: FinderLine): string => FINDER_LINES.find((l) => l.key === k)!.text;

/** How much credit the demo bot keeps for its own claim bonds, and when it tops up. */
export const FINDER_TOP_UP = CLAIM_BOND * 10n;
