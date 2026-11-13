// A stand-in for the contract, in memory, for NEXT_PUBLIC_MOCK=1. lib/chain.ts delegates here.
//
// It follows contracts/found_it.py on everything deterministic: who may call what and when, the order of
// the checks and their refusal sentences word for word, the seal (sha256 of the marks, a bar and the
// salt), one claim at a time, two claims per address per item, the reveal window and default, the item
// exposed after a judged claim until its owner reseals, a digest never sealed twice, where every atto
// goes, the counters, and every view in the contract's own JSON shape, so the mappers in lib/chain.ts run
// on the same rows in both modes. The one thing it cannot do is ask a model: a reveal is judged by the
// word count in lib/judge.ts, and the demo bar says so on every page.
//
// The visitor acts as one of two accounts. The demo bot (the demo owner of the three demo items, and the
// demo finder) answers when the site asks it, through the in-memory twins of /api/demo/*. State lasts
// as long as the tab; the clock can be moved on so a reveal window or a claim deadline can run out.

import type { Call, DemoAnswer, DemoStatus, TxStatus, WriteFn } from "./types.ts";
import { notify } from "./browser-store.ts";
import { CONTRACT_RULES as RULES } from "./contract-rules.ts";
import { DEMO_ITEMS, demoOfTitle, finderLine, isFinderLine, setOfSeal, type DemoItem, type DemoSlug } from "./demo-items.ts";
import { judgeByWords } from "./judge.ts";
import {
  CLAIM_BOND,
  CLAIMS_PER_FINDER,
  DIGEST_CHARS,
  GEN,
  MAX_ARG,
  MAX_CLAIM_AHEAD,
  MAX_DESCRIPTION,
  MAX_MARKS,
  MAX_PUBLIC,
  MAX_REVEAL,
  MAX_REWARD,
  MAX_SALT,
  MAX_TITLE,
  MIN_CLAIM_AHEAD,
  MIN_DESCRIPTION,
  MIN_MARKS,
  MIN_PUBLIC,
  MIN_REVEAL,
  MIN_REWARD,
  MIN_SALT,
  MIN_TITLE,
  PAGE,
  WHY,
  digestOf,
  idOf,
  isId,
  isSalt,
  pyStrip,
  textProblem,
  whole,
  wholeAtto,
  type Finding,
  type ItemStatus,
} from "./rules.ts";
import { sealOf } from "./seal.ts";

export const MOCK_CONTRACT = "0x0000000000000000000000000000000000f0a71d";

const inBrowser = typeof window !== "undefined";
const delay = (ms: number) => (inBrowser ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

// ---- the clock -----------------------------------------------------------------------------------

let clockOffset = 0;
/** The mock's message clock, in seconds: the browser's clock plus however far the visitor moved it on. */
export const mockNow = (): number => Math.floor(Date.now() / 1000) + clockOffset;
export const mockClockOffset = (): number => clockOffset;
/** Moves the mock clock on, so a reveal window or a claim deadline can be seen running out. */
export function advanceClock(seconds: number): void {
  clockOffset += Math.max(0, Math.floor(seconds));
  notify();
}

// ---- who the visitor is acting as -----------------------------------------------------------------

export type Persona = { address: string; name: string; note: string };

export const VISITOR = "0x5e1a3c9b07d24f68a1e3c5b7d9f0a2c4e6b8d0f1";
export const PASSER_BY = "0x91c3e5a7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9";
export const DEMO_BOT = "0xd3e5f7a9b1c2d4e6f8a0b2c4d6e8f0a1b3c5d7e9";
export const EARLIER_OWNER = "0xb4d6f8a0c2e4a6b8d0f2c4e6a8b0d2f4c6e8a0b2";

export const PERSONAS: Persona[] = [
  { address: VISITOR, name: "You", note: "find the demo items, or post one of your own" },
  { address: PASSER_BY, name: "A passer-by", note: "may claim, and may default a claim left unanswered" },
];

let persona = VISITOR;
export const mockAddress = (): string => persona;
export function setMockPersona(address: string): void {
  if (PERSONAS.some((p) => p.address === address)) persona = address;
  notify();
}

// ---- balances -------------------------------------------------------------------------------------

const balances = new Map<string, bigint>([
  [VISITOR, 20n * GEN],
  [PASSER_BY, 3n * GEN],
  [DEMO_BOT, 30n * GEN],
  [EARLIER_OWNER, 8n * GEN],
]);
const balance = (a: string) => balances.get(a.toLowerCase()) ?? 0n;
const credit = (a: string, v: bigint) => balances.set(a.toLowerCase(), balance(a) + v);
let contractBalance = 0n;

export const mockBalanceText = (address: string): string => balance(address).toString();
export const mockContractBalance = (): bigint => contractBalance;
export const ACCOUNTS = [VISITOR, PASSER_BY, DEMO_BOT, EARLIER_OWNER];

// ---- the contract's state -------------------------------------------------------------------------

type ItemRec = {
  owner: string;
  title: string;
  public_description: string;
  reward: bigint;
  reveal_seconds: number;
  posted_at: number;
  claim_by: number;
  status: string;
  marks_digest: string;
  seals: number;
  pending: string;
  revealed_digest: string;
  revealed_marks: string;
  revealed_salt: string;
  revealed_at: number;
  claims: number;
  matched: number;
  no_match: number;
  unclear: number;
  defaulted: number;
  returned_by: string;
  closed_at: number;
};

type ClaimRec = {
  item: string;
  finder: string;
  number: number;
  description: string;
  at: number;
  reveal_by: number;
  digest: string;
  status: string;
  finding: string;
  marks: string;
  reward: bigint;
  bond: bigint;
  bond_to: string;
  settled_at: number;
};

const itemRows = new Map<string, ItemRec>();
const claimRows = new Map<string, ClaimRec>();
const claimIndex = new Map<string, string>();
const claimedRows = new Map<string, number>();
const sealedRows = new Set<string>();
const partyRows = new Map<string, string>();
const partyCount = new Map<string, number>();
const creditRows = new Map<string, bigint>();
const n = {
  item_count: 0,
  claim_count: 0,
  returned_count: 0,
  withdrawn_count: 0,
  matched_count: 0,
  no_match_count: 0,
  unclear_count: 0,
  defaulted_count: 0,
  reseal_count: 0,
  refund_count: 0,
  credits_held: 0n,
  rewards_held: 0n,
  bonds_held: 0n,
  rewards_paid_total: 0n,
  bonds_to_owners_total: 0n,
  rewards_back_total: 0n,
};

type Row = Record<string, unknown>;
type Ctx = { sender: string; value: bigint; now: number };

/** A raised refusal: the transaction runs and changes nothing. */
class Refused extends Error {}
const fail = (message: string): never => {
  throw new Refused("[EXPECTED] " + message);
};

const low = (a: string) => a.toLowerCase();
const creditOf = (me: string) => creditRows.get(me) ?? 0n;
const claimedOf = (key: string) => claimedRows.get(key) ?? 0;
const partyOf = (who: string) => partyCount.get(who) ?? 0;

function transfer(to: string, value: bigint): void {
  if (value <= 0n) return;
  contractBalance -= value;
  credit(to, value);
}

function index(who: string, lid: string): void {
  const k = partyOf(who) + 1;
  partyCount.set(who, k);
  partyRows.set(who + ":" + k, lid);
}

function known(raw: unknown): string {
  const lid = idOf(raw);
  if (!isId(lid, "L") || !itemRows.has(lid)) fail("no item " + lid.slice(0, 12));
  return lid;
}

function refuse(sender: string, value: bigint, reason: string): Row {
  n.refund_count += 1;
  if (value > 0n) transfer(sender, value);
  return { ok: false, reason, returned: value.toString() };
}

// ---- the writes, in the contract's order of checks -------------------------------------------------

function deposit(c: Ctx): Row {
  if (c.value <= 0n) return refuse(c.sender, c.value, "send the value to hold as credit for claim bonds with this call");
  const me = low(c.sender);
  const held = creditOf(me) + c.value;
  creditRows.set(me, held);
  n.credits_held += c.value;
  return { ok: true, deposited: c.value.toString(), credit: held.toString() };
}

function withdraw(c: Ctx, amountRaw: unknown): Row {
  const me = low(c.sender);
  const held = creditOf(me);
  if (held <= 0n) fail("this address holds no credit here");
  const amount = wholeAtto(amountRaw);
  if (amount < 1n || amount > held) fail("withdraw 1 to " + held.toString() + " atto, the credit this address holds, written in digits");
  creditRows.set(me, held - amount);
  n.credits_held -= amount;
  transfer(c.sender, amount);
  return { ok: true, returned: amount.toString(), credit: (held - amount).toString() };
}

function postLost(c: Ctx, title: unknown, pub: unknown, marksDigest: unknown, revealRaw: unknown, claimByRaw: unknown): Row {
  const value = c.value;
  const reveal = whole(revealRaw);
  const until = whole(claimByRaw);
  const digest = digestOf(marksDigest);
  let problem = textProblem(title, MIN_TITLE, MAX_TITLE, "the title");
  if (!problem) problem = textProblem(pub, MIN_PUBLIC, MAX_PUBLIC, "the public description");
  if (!problem && !digest) problem = 'the marks digest is sha256(hidden_marks + "|" + salt), written as ' + DIGEST_CHARS + " hexadecimal characters";
  if (!problem && !(MIN_REVEAL <= reveal && reveal <= MAX_REVEAL)) problem = "the reveal window is " + MIN_REVEAL + " to " + MAX_REVEAL + " seconds (ten minutes to seven days)";
  if (!problem && !(MIN_REWARD <= value && value <= MAX_REWARD))
    problem = "send the reward with this call: " + MIN_REWARD.toString() + " to " + MAX_REWARD.toString() + " atto (0.05 to 50 GEN); this sends " + value.toString();
  const now = c.now;
  if (!problem && !(now + MIN_CLAIM_AHEAD <= until && until <= now + MAX_CLAIM_AHEAD))
    problem = "claim_by is a unix time from " + MIN_CLAIM_AHEAD + " seconds to 365 days after now, " + now + ", written in digits";
  if (problem) return refuse(c.sender, value, problem);
  n.item_count += 1;
  const lid = "L" + n.item_count;
  itemRows.set(lid, {
    owner: c.sender,
    title: pyStrip(String(title)),
    public_description: pyStrip(String(pub)),
    reward: value,
    reveal_seconds: reveal,
    posted_at: now,
    claim_by: until,
    status: "open",
    marks_digest: digest,
    seals: 1,
    pending: "",
    revealed_digest: "",
    revealed_marks: "",
    revealed_salt: "",
    revealed_at: 0,
    claims: 0,
    matched: 0,
    no_match: 0,
    unclear: 0,
    defaulted: 0,
    returned_by: "",
    closed_at: 0,
  });
  sealedRows.add(lid + ":" + digest);
  n.rewards_held += value;
  index(low(c.sender), lid);
  return { ok: true, item: lid, reward: value.toString(), claim_bond: CLAIM_BOND.toString(), posted_at: now, claim_by: until, reveal_seconds: reveal };
}

function claim(c: Ctx, item: unknown, description: unknown): Row {
  const me = low(c.sender);
  const lid = known(item);
  const t = itemRows.get(lid)!;
  if (me === low(t.owner)) fail("the owner of " + lid + " may not claim their own item");
  const status = t.status;
  if (status === "claimed") fail(lid + " has a claim pending, " + t.pending + "; one claim at a time, so it takes the next once that one is settled");
  if (status === "exposed")
    fail("the hidden marks of " + lid + " were revealed at " + t.revealed_at + " and are public, so a claim against them could only copy them; " + lid + " takes claims again once its owner seals new marks");
  if (status !== "open") fail(lid + " is " + status + " and takes no claim");
  const now = c.now;
  if (now >= t.claim_by) fail("claims on " + lid + " closed at " + t.claim_by);
  const key = lid + ":" + me;
  const made = claimedOf(key);
  if (made >= CLAIMS_PER_FINDER) fail("this address has claimed " + lid + " " + made + " times; one address claims an item at most " + CLAIMS_PER_FINDER + " times");
  const problem = textProblem(description, MIN_DESCRIPTION, MAX_DESCRIPTION, "the description");
  if (problem) fail(problem);
  const held = creditOf(me);
  if (held < CLAIM_BOND) fail("a claim stakes the claim bond, " + CLAIM_BOND.toString() + " atto, from your credit, which holds " + held.toString() + "; deposit() it first");
  n.claim_count += 1;
  const cid = "C" + n.claim_count;
  t.claims += 1;
  const number = t.claims;
  claimIndex.set(lid + ":" + number, cid);
  claimedRows.set(key, made + 1);
  if (made === 0) index(me, lid);
  creditRows.set(me, held - CLAIM_BOND);
  n.credits_held -= CLAIM_BOND;
  n.bonds_held += CLAIM_BOND;
  const revealBy = now + t.reveal_seconds;
  claimRows.set(cid, {
    item: lid,
    finder: c.sender,
    number,
    description: pyStrip(String(description)),
    at: now,
    reveal_by: revealBy,
    digest: t.marks_digest,
    status: "pending",
    finding: "",
    marks: "",
    reward: 0n,
    bond: CLAIM_BOND,
    bond_to: "",
    settled_at: 0,
  });
  t.pending = cid;
  t.status = "claimed";
  return { ok: true, claim: cid, item: lid, number, bond: CLAIM_BOND.toString(), credit: (held - CLAIM_BOND).toString(), reveal_by: revealBy };
}

function settle(lid: string, t: ItemRec, cid: string, x: ClaimRec, finding: Exclude<Finding, "">, marks: string, salt: string, now: number): Row {
  const finder = low(x.finder);
  const bond = x.bond;
  let reward = 0n;
  let toOwner = 0n;
  if (finding === "match" || finding === "default") {
    reward = t.reward;
    n.rewards_held -= reward;
    n.rewards_paid_total += reward;
    n.returned_count += 1;
    t.status = "returned";
    t.returned_by = cid;
    t.closed_at = now;
  } else t.status = "exposed";
  let bondTo: string;
  if (finding === "no_match") {
    toOwner = bond;
    bondTo = "owner";
    n.bonds_to_owners_total += bond;
  } else {
    bondTo = "credit";
    creditRows.set(finder, creditOf(finder) + bond);
    n.credits_held += bond;
  }
  n.bonds_held -= bond;
  if (finding !== "default") {
    t.revealed_digest = t.marks_digest;
    t.revealed_marks = marks;
    t.revealed_salt = salt;
    t.revealed_at = now;
    x.marks = marks;
  }
  if (finding === "match") {
    t.matched += 1;
    n.matched_count += 1;
  } else if (finding === "no_match") {
    t.no_match += 1;
    n.no_match_count += 1;
  } else if (finding === "unclear") {
    t.unclear += 1;
    n.unclear_count += 1;
  } else {
    t.defaulted += 1;
    n.defaulted_count += 1;
  }
  t.pending = "";
  x.status = "settled";
  x.finding = finding;
  x.reward = reward;
  x.bond_to = bondTo;
  x.settled_at = now;
  if (reward > 0n) transfer(x.finder, reward);
  if (toOwner > 0n) transfer(t.owner, toOwner);
  return { ok: true, claim: cid, item: lid, finding, status: t.status, reward: reward.toString(), bond: bond.toString(), bond_to: bondTo, credit: creditOf(finder).toString(), why: WHY[finding] };
}

function reveal(c: Ctx, item: unknown, hiddenMarks: unknown, salt: unknown): Row {
  const lid = known(item);
  const t = itemRows.get(lid)!;
  if (low(c.sender) !== low(t.owner)) fail("only the owner of " + lid + " may reveal its hidden marks");
  if (t.status !== "claimed") fail(lid + " is " + t.status + " with no claim pending; the hidden marks are revealed only to judge a pending claim");
  const cid = t.pending;
  const x = claimRows.get(cid)!;
  const now = c.now;
  if (now >= x.reveal_by) fail("the reveal window of " + cid + " closed at " + x.reveal_by + "; anyone may now call default(" + lid + "), which pays the claim");
  let problem = textProblem(hiddenMarks, MIN_MARKS, MAX_MARKS, "the text of the hidden marks");
  if (!problem && !isSalt(salt)) problem = "the salt is " + MIN_SALT + " to " + MAX_SALT + " ASCII letters and digits";
  if (problem) fail(problem);
  if (sealOf(String(hiddenMarks), String(salt)) !== t.marks_digest) fail("these hidden marks and this salt do not match the digest sealed for " + lid);
  const finding = judgeByWords(String(hiddenMarks), x.description);
  return settle(lid, t, cid, x, finding, String(hiddenMarks), String(salt), now);
}

function defaultClaim(c: Ctx, item: unknown): Row {
  const lid = known(item);
  const t = itemRows.get(lid)!;
  if (t.status !== "claimed") fail(lid + " is " + t.status + " with no claim pending; default pays only a claim its owner did not answer");
  const cid = t.pending;
  const x = claimRows.get(cid)!;
  const now = c.now;
  if (now < x.reveal_by) fail("the reveal window of " + cid + " is open for another " + (x.reveal_by - now) + " seconds; default pays the claim only once the owner has let it pass");
  return settle(lid, t, cid, x, "default", "", "", now);
}

function reseal(c: Ctx, item: unknown, marksDigest: unknown): Row {
  const lid = known(item);
  const t = itemRows.get(lid)!;
  if (low(c.sender) !== low(t.owner)) fail("only the owner of " + lid + " may seal its hidden marks");
  if (t.status !== "exposed") fail(lid + " is " + t.status + "; new marks are sealed only after a judged claim made the last ones public");
  const now = c.now;
  if (now >= t.claim_by) fail("claims on " + lid + " closed at " + t.claim_by + "; withdraw_reward(" + lid + ") takes the reward back");
  const digest = digestOf(marksDigest);
  if (!digest) fail('the marks digest is sha256(hidden_marks + "|" + salt), written as ' + DIGEST_CHARS + " hexadecimal characters");
  if (sealedRows.has(lid + ":" + digest)) fail(lid + " has sealed this digest before, and its marks may be public; seal marks nobody has seen");
  sealedRows.add(lid + ":" + digest);
  t.marks_digest = digest;
  t.seals += 1;
  t.status = "open";
  n.reseal_count += 1;
  return { ok: true, item: lid, status: "open", seals: t.seals, claim_by: t.claim_by };
}

function withdrawReward(c: Ctx, item: unknown): Row {
  const lid = known(item);
  const t = itemRows.get(lid)!;
  if (low(c.sender) !== low(t.owner)) fail("only the owner of " + lid + " may take its reward back");
  const status = t.status;
  if (status === "claimed") fail(lid + " has a claim pending, " + t.pending + "; it is settled by reveal() or default() first");
  if (status !== "open" && status !== "exposed") fail(lid + " is " + status + "; its reward has already left");
  const now = c.now;
  if (now < t.claim_by) fail("claims on " + lid + " are open for another " + (t.claim_by - now) + " seconds; the reward comes back only once claim_by has passed with no successful claim");
  const amount = t.reward;
  t.status = "withdrawn";
  t.closed_at = now;
  n.rewards_held -= amount;
  n.rewards_back_total += amount;
  n.withdrawn_count += 1;
  transfer(t.owner, amount);
  return { ok: true, item: lid, status: "withdrawn", returned: amount.toString(), closed_at: now };
}

function run(fn: WriteFn, args: unknown[], c: Ctx): Row {
  switch (fn) {
    case "deposit":
      return deposit(c);
    case "withdraw":
      return withdraw(c, args[0]);
    case "post_lost":
      return postLost(c, args[0], args[1], args[2], args[3], args[4]);
    case "claim":
      return claim(c, args[0], args[1]);
    case "reveal":
      return reveal(c, args[0], args[1], args[2]);
    case "default":
      return defaultClaim(c, args[0]);
    case "reseal":
      return reseal(c, args[0], args[1]);
    case "withdraw_reward":
      return withdrawReward(c, args[0]);
  }
}

// ---- the views, in the contract's JSON -------------------------------------------------------------

function claimRow(cid: string, x: ClaimRec): Row {
  return {
    claim: cid,
    item: x.item,
    finder: low(x.finder),
    number: x.number,
    description: x.description,
    at: x.at,
    reveal_by: x.reveal_by,
    digest: x.digest,
    status: x.status,
    finding: x.finding,
    marks: x.marks,
    reward: x.reward.toString(),
    bond: x.bond.toString(),
    bond_to: x.bond_to,
    settled_at: x.settled_at,
    why: (WHY as Record<string, string>)[x.finding] ?? "",
  };
}

const sizeOf = (raw: unknown) => Math.min(Math.max(whole(raw), 1), PAGE);
const startOf = (raw: unknown) => Math.max(whole(raw), 0);
const addrArg = (who: unknown) => (typeof who === "string" && who.length <= MAX_ARG ? pyStrip(who).toLowerCase() : "");

export async function view(fn: string, args: (string | number)[]): Promise<string> {
  seed();
  await delay(80);
  const now = mockNow();
  switch (fn) {
    case "item": {
      const lid = idOf(args[0]);
      const t = itemRows.get(lid);
      if (!t) return JSON.stringify({ error: "no item " + lid.slice(0, 12) });
      let pending: Row | null = null;
      let revealBy = 0;
      if (t.status === "claimed") {
        const x = claimRows.get(t.pending)!;
        pending = claimRow(t.pending, x);
        revealBy = x.reveal_by;
      }
      return JSON.stringify({
        item: lid,
        owner: low(t.owner),
        title: t.title,
        public_description: t.public_description,
        reward: t.reward.toString(),
        claim_bond: CLAIM_BOND.toString(),
        reveal_seconds: t.reveal_seconds,
        posted_at: t.posted_at,
        claim_by: t.claim_by,
        status: t.status,
        marks_digest: t.marks_digest,
        seals: t.seals,
        sealed: t.revealed_digest !== t.marks_digest,
        pending,
        revealed_marks: t.revealed_marks,
        revealed_salt: t.revealed_salt,
        revealed_digest: t.revealed_digest,
        revealed_at: t.revealed_at,
        claims: t.claims,
        matched: t.matched,
        no_match: t.no_match,
        unclear: t.unclear,
        defaulted: t.defaulted,
        returned_by: t.returned_by,
        closed_at: t.closed_at,
        now,
        claimable: t.status === "open" && 0 <= now && now < t.claim_by,
        defaultable: t.status === "claimed" && now >= revealBy,
        resealable: t.status === "exposed" && 0 <= now && now < t.claim_by,
        withdrawable: (t.status === "open" || t.status === "exposed") && now >= t.claim_by,
      });
    }
    case "items": {
      const total = n.item_count;
      const start = startOf(args[0]);
      const size = sizeOf(args[1]);
      const count = Math.min(Math.max(total - start, 0), size, PAGE);
      const rows = [];
      for (let i = 0; i < count; i++) {
        const lid = "L" + (start + 1 + i);
        const t = itemRows.get(lid)!;
        rows.push({ item: lid, owner: low(t.owner), title: t.title, status: t.status, reward: t.reward.toString(), claim_by: t.claim_by, claims: t.claims });
      }
      return JSON.stringify({ total, offset: start, limit: size, rows });
    }
    case "items_of": {
      const addr = addrArg(args[0]);
      const total = partyOf(addr);
      const start = startOf(args[1]);
      const size = sizeOf(args[2]);
      const count = Math.min(Math.max(total - start, 0), size, PAGE);
      const rows = [];
      for (let i = 0; i < count; i++) {
        const lid = partyRows.get(addr + ":" + (start + 1 + i))!;
        const t = itemRows.get(lid)!;
        rows.push({ item: lid, role: addr === low(t.owner) ? "owner" : "finder", title: t.title, status: t.status, reward: t.reward.toString(), claims: t.claims });
      }
      return JSON.stringify({ who: addr.slice(0, 42), total, offset: start, limit: size, rows });
    }
    case "claims_of": {
      const lid = idOf(args[0]);
      const t = itemRows.get(lid);
      if (!t) return JSON.stringify({ error: "no item " + lid.slice(0, 12) });
      const total = t.claims;
      const start = startOf(args[1]);
      const size = sizeOf(args[2]);
      const count = Math.min(Math.max(total - start, 0), size, PAGE);
      const rows = [];
      for (let i = 0; i < count; i++) {
        const cid = claimIndex.get(lid + ":" + (start + 1 + i))!;
        rows.push(claimRow(cid, claimRows.get(cid)!));
      }
      return JSON.stringify({ item: lid, total, offset: start, limit: size, rows });
    }
    case "credit": {
      const addr = addrArg(args[0]);
      return JSON.stringify({ who: addr.slice(0, 42), credit: creditOf(addr).toString() });
    }
    case "stats": {
      const held = n.credits_held + n.rewards_held + n.bonds_held;
      return JSON.stringify({
        items: n.item_count,
        returned: n.returned_count,
        withdrawn: n.withdrawn_count,
        claims: n.claim_count,
        matched: n.matched_count,
        no_match: n.no_match_count,
        unclear: n.unclear_count,
        defaulted: n.defaulted_count,
        reseals: n.reseal_count,
        refunds: n.refund_count,
        credits_held: n.credits_held.toString(),
        rewards_held: n.rewards_held.toString(),
        bonds_held: n.bonds_held.toString(),
        rewards_paid: n.rewards_paid_total.toString(),
        bonds_to_owners: n.bonds_to_owners_total.toString(),
        rewards_back: n.rewards_back_total.toString(),
        balance_owed: held.toString(),
        now,
      });
    }
    case "rules":
      return JSON.stringify(RULES);
    default:
      throw new Error("the mock has no view " + fn);
  }
}

// ---- transactions ---------------------------------------------------------------------------------

type Pending = { fn: string; polls: number; result: Row; error: string; judged: boolean };
const pending = new Map<string, Pending>();
let txCount = 0;
const fakeHash = () => "0x" + (++txCount).toString(16).padStart(8, "0") + "f0a71d5e".repeat(7);

/** Runs one call as `sender` and records it as a transaction; the hash comes back at once. */
function send(sender: string, fn: WriteFn, args: unknown[], value: bigint): string {
  if (value > balance(sender)) throw new Error("insufficient funds for this demo account");
  if (value > 0n) {
    credit(sender, -value);
    contractBalance += value;
  }
  let result: Row = {};
  let error = "";
  try {
    result = run(fn, args, { sender, value, now: mockNow() });
  } catch (e) {
    if (!(e instanceof Refused)) throw e;
    // A raised refusal changes nothing; no write that takes value raises, but the value goes back regardless.
    if (value > 0n) {
      contractBalance -= value;
      credit(sender, value);
    }
    error = e.message;
  }
  const hash = fakeHash();
  pending.set(hash, { fn, polls: 0, result, error, judged: fn === "reveal" && !error });
  notify();
  return hash;
}

export async function write(call: Call): Promise<string> {
  seed();
  await delay(250);
  return send(persona.toLowerCase(), call.fn, call.args, call.value ?? 0n);
}

const STAGES = ["PENDING", "PROPOSING", "COMMITTING", "REVEALING", "ACCEPTED", "FINALIZED"];
const NO_VOTES = { agree: 0, disagree: 0, idle: 0 };

export async function txStatus(hash: string): Promise<TxStatus> {
  await delay(60);
  const p = pending.get(hash);
  if (!p) return { status: "UNKNOWN", votes: NO_VOTES, applied: null, undetermined: false, exec: null, result: null, message: "" };
  p.polls += 1;
  // A reveal asks every validator four questions, so it moves slower.
  const stages = p.judged ? Math.max(1, Math.floor(p.polls / 2)) : p.polls;
  const done = stages >= STAGES.length;
  const agree = done ? 4 : p.judged ? Math.min(Math.max(0, stages - 2), 4) : 0;
  return {
    status: STAGES[Math.min(stages - 1, STAGES.length - 1)],
    votes: { agree, disagree: 0, idle: done || agree ? 5 - agree : 0 },
    applied: done ? true : null,
    undetermined: false,
    exec: done ? (p.error ? "ERROR" : "SUCCESS") : null,
    result: done && !p.error ? p.result : null,
    message: done ? p.error || JSON.stringify(p.result) : "",
  };
}

/** True once a transaction the mock knows has been polled to a final status (or it never existed). */
const isDone = (hash: string): boolean => {
  const p = pending.get(hash);
  if (!p) return true;
  return (p.judged ? Math.floor(p.polls / 2) : p.polls) >= STAGES.length;
};

export async function balanceOf(address: string): Promise<bigint> {
  await delay(40);
  return balance(address);
}

export async function faucet(address: string): Promise<bigint> {
  await delay(400);
  credit(address, 10n * GEN);
  notify();
  return balance(address);
}

// ---- the demo bot: the in-memory twins of /api/demo/* ------------------------------------------------

/** The demo salt of mock mode: the bot's key is a fixed word here, never a real key. */
const mockSalt = (slug: DemoSlug, seal: number) => sealOf("mock demo salt|" + slug, String(seal)).slice(0, 32);

/** The newest item the demo owner posted for each demo slug. */
function demoShelf(): { slug: DemoSlug; item: string; status: ItemStatus | "" }[] {
  const out: { slug: DemoSlug; item: string; status: ItemStatus | "" }[] = [];
  for (const d of DEMO_ITEMS) {
    let best = "";
    for (const [lid, t] of itemRows) if (low(t.owner) === DEMO_BOT && t.title === d.title && Number(lid.slice(1)) > Number(best.slice(1) || 0)) best = lid;
    out.push({ slug: d.slug, item: best, status: best ? (itemRows.get(best)!.status as ItemStatus) : "" });
  }
  return out;
}

export function demoStatus(): DemoStatus {
  seed();
  const finder = creditOf(DEMO_BOT) >= CLAIM_BOND;
  return { online: true, bot: DEMO_BOT, reason: "", items: demoShelf(), finder, finderReason: finder ? "" : "the demo finder holds no credit for a claim bond" };
}

const lastDemoTx = new Map<string, string>();

/** The demo item an id is, with its record, or why the demo bot will not touch it. */
function demoItemOf(raw: string): { lid: string; t: ItemRec; d: DemoItem } | { why: string } {
  const lid = idOf(raw);
  const t = itemRows.get(lid);
  if (!t) return { why: "no item " + lid.slice(0, 12) };
  const d = demoOfTitle(t.title);
  if (low(t.owner) !== DEMO_BOT || !d) return { why: `${lid} is not one of the demo owner's items` };
  return { lid, t, d };
}

function busy(lid: string): string {
  const last = lastDemoTx.get(lid);
  return last && !isDone(last) ? `the demo bot is still waiting for its last call on ${lid} to be final; try again once it is` : "";
}

export async function demoReveal(raw: string): Promise<DemoAnswer> {
  seed();
  await delay(300);
  const found = demoItemOf(raw);
  if ("why" in found) return { ok: false, reason: found.why };
  const { lid, t, d } = found;
  const b = busy(lid);
  if (b) return { ok: false, reason: b };
  if (t.status !== "claimed") return { ok: false, reason: `${lid} is ${t.status} with no claim pending; the demo owner reveals only for a pending claim` };
  if (mockNow() >= claimRows.get(t.pending)!.reveal_by) return { ok: false, reason: `the reveal window of ${t.pending} has closed; anyone may now call default(${lid}), which pays the claim` };
  const hash = send(DEMO_BOT, "reveal", [lid, setOfSeal(d, t.seals).marks, mockSalt(d.slug, t.seals)], 0n);
  lastDemoTx.set(lid, hash);
  return { ok: true, hash };
}

export async function demoReseal(raw: string): Promise<DemoAnswer> {
  seed();
  await delay(300);
  const found = demoItemOf(raw);
  if ("why" in found) return { ok: false, reason: found.why };
  const { lid, t, d } = found;
  const b = busy(lid);
  if (b) return { ok: false, reason: b };
  if (t.status !== "exposed") return { ok: false, reason: `${lid} is ${t.status}; the demo owner seals new marks only on an item whose last marks were revealed` };
  const next = t.seals + 1;
  const hash = send(DEMO_BOT, "reseal", [lid, sealOf(setOfSeal(d, next).marks, mockSalt(d.slug, next))], 0n);
  lastDemoTx.set(lid, hash);
  return { ok: true, hash };
}

export async function demoRepost(raw: string): Promise<DemoAnswer> {
  seed();
  await delay(300);
  const found = demoItemOf(raw);
  if ("why" in found) return { ok: false, reason: found.why };
  const { lid, t, d } = found;
  if (t.status !== "returned" && t.status !== "withdrawn") return { ok: false, reason: `${lid} is ${t.status}; the demo owner puts an item back on the shelf only once it was returned` };
  const newest = demoShelf().find((s) => s.slug === d.slug)!;
  if (newest.item !== lid) return { ok: false, reason: `the ${d.slug} is back on the shelf already, as ${newest.item}` };
  const b = busy(lid);
  if (b) return { ok: false, reason: b };
  const hash = send(DEMO_BOT, "post_lost", [d.title, d.publicDescription, sealOf(setOfSeal(d, 1).marks, mockSalt(d.slug, 1)), d.revealSeconds, mockNow() + d.claimAhead], d.rewardAtto);
  lastDemoTx.set(lid, hash);
  return { ok: true, hash };
}

export async function demoClaim(raw: string, line: string): Promise<DemoAnswer> {
  seed();
  await delay(300);
  if (!isFinderLine(line)) return { ok: false, reason: "the demo finder says only one of its three lines" };
  const lid = idOf(raw);
  const t = itemRows.get(lid);
  if (!t) return { ok: false, reason: "no item " + lid.slice(0, 12) };
  if (low(t.owner) === DEMO_BOT) return { ok: false, reason: `${lid} is the demo owner's own item; the demo finder claims only items visitors post` };
  if (t.status !== "open") return { ok: false, reason: `${lid} is ${t.status}; the demo finder claims only an open item` };
  if (claimedOf(lid + ":" + DEMO_BOT) >= CLAIMS_PER_FINDER) return { ok: false, reason: `the demo finder has claimed ${lid} ${CLAIMS_PER_FINDER} times, the most one address may` };
  const b = busy(lid);
  if (b) return { ok: false, reason: b };
  if (creditOf(DEMO_BOT) < CLAIM_BOND) send(DEMO_BOT, "deposit", [], CLAIM_BOND * 10n);
  const hash = send(DEMO_BOT, "claim", [lid, finderLine(line)], 0n);
  lastDemoTx.set(lid, hash);
  return { ok: true, hash };
}

// ---- seeding ---------------------------------------------------------------------------------------

let seeded = false;

/** Runs a call at a given instant, outside the transaction log: the seeded past. */
function at(sender: string, now: number, fn: WriteFn, args: unknown[], value = 0n): Row {
  if (value > 0n) {
    credit(sender, -value);
    contractBalance += value;
  }
  return run(fn, args, { sender, value, now });
}

const EARLIER_MARKS = "a photo of a grey cat tucked behind the bank card; a bus pass for Rhea Lund; a torn corner on the coin flap";
const EARLIER_SALT = "earlierwalletsalt0042";

function seed(): void {
  if (seeded) return;
  seeded = true;
  const now = mockNow();
  const ago = (s: number) => now - s;
  // An earlier owner lost a wallet; the passer-by found it and was paid.
  at(EARLIER_OWNER, ago(9 * 86400), "post_lost", ["Brown wallet, Quay Road tram", "A brown leather wallet dropped on the Quay Road tram near the ferry stop, on a wet Monday.", sealOf(EARLIER_MARKS, EARLIER_SALT), 86400, ago(9 * 86400) + 30 * 86400], GEN / 5n);
  at(PASSER_BY, ago(8 * 86400), "deposit", [], CLAIM_BOND * 2n);
  at(PASSER_BY, ago(8 * 86400 - 60), "claim", ["L1", "There is a photo of a grey cat behind the bank card, and a bus pass for Rhea Lund."]);
  at(EARLIER_OWNER, ago(8 * 86400 - 3600), "reveal", ["L1", EARLIER_MARKS, EARLIER_SALT]);
  // The demo bot keeps its credit for claim bonds, and its three items on the shelf.
  at(DEMO_BOT, ago(3 * 86400), "deposit", [], CLAIM_BOND * 10n);
  for (const d of DEMO_ITEMS) {
    const when = ago(3 * 86400 - 60);
    at(DEMO_BOT, when, "post_lost", [d.title, d.publicDescription, sealOf(setOfSeal(d, 1).marks, mockSalt(d.slug, 1)), d.revealSeconds, when + d.claimAhead], d.rewardAtto);
  }
}

/** What the contract holds by its own books, and what it holds in fact: the two must be equal. */
export function mockHeld(): { held: bigint; balance: bigint } {
  seed();
  return { held: n.credits_held + n.rewards_held + n.bonds_held, balance: contractBalance };
}

/** The seal the demo owner holds for a demo item in mock mode (for tests). */
export const mockDemoSeal = (slug: DemoSlug, seal: number) => mockSalt(slug, seal);
