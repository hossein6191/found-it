// The shapes the pages use, with no runtime code: lib/chain.ts maps every view answer into these, and
// lib/chain-mock.ts answers in the contract's own JSON so the same mappers run in both modes. Every
// instant is seconds on the message clock, 0 until it happens; every amount is a decimal string of atto.

import type { BondTo, Finding, ItemStatus } from "./rules.ts";

/** One claim, as claims_of() and item().pending show it. */
export type Claim = {
  /** "C4" */
  id: string;
  item: string;
  finder: string;
  /** the claim's place on its item: 1 for the first */
  number: number;
  description: string;
  at: number;
  revealBy: number;
  /** the seal it was made against */
  digest: string;
  status: "pending" | "settled";
  finding: Finding;
  /** the marks it was judged against; "" while pending and for a default */
  marks: string;
  rewardAtto: string;
  bondAtto: string;
  bondTo: BondTo;
  settledAt: number;
  /** the contract's own reason for its finding */
  why: string;
};

/** item(id): one lost item, its seal, its pending claim, the last marks revealed and what may happen now. */
export type Item = {
  /** "L2" */
  id: string;
  owner: string;
  title: string;
  publicDescription: string;
  rewardAtto: string;
  claimBondAtto: string;
  revealSeconds: number;
  postedAt: number;
  claimBy: number;
  status: ItemStatus;
  marksDigest: string;
  seals: number;
  /** true while the current seal has not been revealed */
  sealed: boolean;
  pending: Claim | null;
  revealedMarks: string;
  revealedSalt: string;
  revealedDigest: string;
  revealedAt: number;
  claims: number;
  matched: number;
  noMatch: number;
  unclear: number;
  defaulted: number;
  returnedBy: string;
  closedAt: number;
  /** the view's own clock; 0 when it had none */
  now: number;
  /** the browser's clock (the mock's in mock mode) when the row was read */
  readAt: number;
  claimable: boolean;
  defaultable: boolean;
  resealable: boolean;
  withdrawable: boolean;
};

/** items(): one row of the shelf. */
export type ItemRow = { id: string; owner: string; title: string; status: ItemStatus; rewardAtto: string; claimBy: number; claims: number };

/** items_of(): one item an address is part of, with its role. */
export type MyRow = { id: string; role: "owner" | "finder"; title: string; status: ItemStatus; rewardAtto: string; claims: number };

export type Paged<T> = { total: number; offset: number; limit: number; rows: T[] };

/** stats(): the contract's totals. */
export type Stats = {
  items: number;
  returned: number;
  withdrawn: number;
  claims: number;
  matched: number;
  noMatch: number;
  unclear: number;
  defaulted: number;
  reseals: number;
  refunds: number;
  creditsHeldAtto: string;
  rewardsHeldAtto: string;
  bondsHeldAtto: string;
  rewardsPaidAtto: string;
  bondsToOwnersAtto: string;
  rewardsBackAtto: string;
  balanceOwedAtto: string;
  now: number;
};

/** rules(): the contract's own words, kept as it wrote them. */
export type Rules = Record<string, unknown>;

export type Votes = { agree: number; disagree: number; idle: number };

export type TxStatus = {
  /** PENDING | PROPOSING | COMMITTING | REVEALING | ACCEPTED | FINALIZED | CANCELED | UNDETERMINED | UNKNOWN */
  status: string;
  votes: Votes;
  applied: boolean | null;
  undetermined: boolean;
  /** SUCCESS | ERROR | null */
  exec: string | null;
  result: Record<string, unknown> | null;
  message: string;
};

export type ReadResult<T> = { data: T; source: "chain" | "mock" };

/** The contract's write methods, by name. */
export type WriteFn = "deposit" | "withdraw" | "post_lost" | "claim" | "reveal" | "default" | "reseal" | "withdraw_reward";

export type Arg = string | number;

/** One contract call, ready to sign: the method, its arguments in the contract's order, and the value sent. */
export type Call = { fn: WriteFn; args: Arg[]; value?: bigint };

/** One of the demo owner's items, as GET /api/demo/status lists it. */
export type DemoShelfItem = { slug: string; item: string; status: ItemStatus | "" };

/**
 * Whether the demo bot can act now, its public address, its three items, whether it can claim as the
 * demo finder (its credit holds a bond), and exactly why not.
 */
export type DemoStatus = {
  online: boolean;
  bot: string;
  reason: string;
  items: DemoShelfItem[];
  finder: boolean;
  finderReason: string;
};

/** What the demo bot answered when asked to act: a transaction hash, or why not. */
export type DemoAnswer = { ok: true; hash: string } | { ok: false; reason: string; retryAfter?: number };
