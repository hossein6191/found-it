// The demo bot, server side only (imported by app/api/demo/*). It holds a throwaway Studio test key from
// the DEMO_OWNER_KEY environment variable and signs exactly five kinds of call with it:
//
//   as the demo owner, on its own three demo items (owner = this key, title one of the demo titles word
//   for word): reveal() of the marks and salt of the current seal, only while a claim is pending and its
//   reveal window is open; reseal() with the next mark set of the item's fixed rotation, only while the
//   item is exposed; post_lost() of a demo item again, only once the newest one of its kind was returned;
//   as the demo finder, on an item a visitor posted: claim() with one of three FIXED lines, and deposit()
//   of a little credit for its bonds when it holds less than one.
//
// Nothing a visitor types is ever signed. The salts are made from the key (lib/demo-items.ts), so the bot
// keeps no state. The key is never logged, never returned and never written anywhere; an answer names
// the bot's public address at most.

import { createAccount, createClient } from "genlayer-js";
import { getAddress, type Address } from "viem";

import { balanceOf, contractAddress, isMock, readClaims, readCredit, readItem, readItemsOfWindow, studio } from "./chain";
import { cleanKey, keyProblem } from "./demo-key";
import { DEMO_LIMITS, createLimiter } from "./demo-limit";
import { DEMO_ITEMS, FINDER_TOP_UP, demoOfTitle, demoSalt, finderLine, setOfSeal, type DemoItem, type FinderLine } from "./demo-items";
import { CLAIM_BOND, CLAIMS_PER_FINDER, idNumber } from "./rules";
import { FINAL_STATUSES, rpc, sleep, statusName, type RawTx } from "./rpc";
import { sealOf } from "./seal";
import type { DemoShelfItem, DemoStatus, Item } from "./types";

type Account = ReturnType<typeof createAccount>;
let account: { key: string; value: Account } | null = null;

function demoKey(): string {
  const raw = process.env.DEMO_OWNER_KEY;
  return keyProblem(raw) ? "" : cleanKey(raw);
}

function demoAccount(): Account | null {
  const key = demoKey();
  if (!key) return null;
  if (!account || account.key !== key) account = { key, value: createAccount(key as `0x${string}`) };
  return account.value;
}

export const MOCK_REASON = "in the demo build the demo bot answers in the browser";
export const NO_CONTRACT_REASON = "the contract is not deployed yet";
export const RPC_DOWN = "Studio's RPC did not answer; try again in a minute";
export const NO_BALANCE = "the demo bot's account holds no GEN and Studio's faucet did not top it up";
export const NOT_POSTED = "the demo items are not posted on this contract yet (tools/open-demo.mjs posts them)";
export const NO_FINDER_CREDIT = "the demo finder holds no credit for a claim bond yet; it deposits some the first time it is asked to claim";

/** The demo bot signs from its own balance; Studio's faucet refills it when it holds less than a GEN. */
async function ensureBalance(bot: string): Promise<boolean> {
  const have = await balanceOf(bot);
  if (have >= 10n ** 18n) return true;
  try {
    await rpc("sim_fundAccount", { account_address: getAddress(bot), amount: 20e18 });
  } catch {
    return have > 0n;
  }
  for (let i = 0; i < 6; i++) {
    await sleep(2000);
    try {
      if ((await balanceOf(bot)) > have) return true;
    } catch {
      /* one dropped read; ask again */
    }
  }
  return have > 0n;
}

/** The newest item this key posted under each demo title. */
async function shelfOf(bot: string): Promise<DemoShelfItem[]> {
  const rows = (await readItemsOfWindow(bot, 3, { fresh: true })).data.rows.filter((r) => r.role === "owner");
  return DEMO_ITEMS.map((d) => {
    const mine = rows.filter((r) => r.title === d.title).sort((a, b) => idNumber(b.id) - idNumber(a.id))[0];
    return { slug: d.slug, item: mine?.id ?? "", status: mine?.status ?? "" };
  });
}

/** Whether the demo bot can act now, its three items, and exactly why not. */
export async function demoStatusNow(): Promise<DemoStatus> {
  const off = (reason: string, bot = ""): DemoStatus => ({ online: false, bot, reason, items: [], finder: false, finderReason: "" });
  if (isMock) return off(MOCK_REASON);
  const problem = keyProblem(process.env.DEMO_OWNER_KEY);
  if (problem) return off(problem);
  const bot = demoAccount()!.address.toLowerCase();
  if (!contractAddress()) return off(NO_CONTRACT_REASON, bot);
  let funded = false;
  try {
    funded = await ensureBalance(bot);
  } catch {
    return off(RPC_DOWN, bot);
  }
  if (!funded) return off(NO_BALANCE, bot);
  let items: DemoShelfItem[];
  let credit = 0n;
  try {
    items = await shelfOf(bot);
    credit = BigInt((await readCredit(bot, { fresh: true })).data);
  } catch {
    return off(RPC_DOWN, bot);
  }
  if (!items.some((i) => i.item)) return { ...off(NOT_POSTED, bot), items };
  const finder = credit >= CLAIM_BOND;
  return { online: true, bot, reason: "", items, finder, finderReason: finder ? "" : NO_FINDER_CREDIT };
}

const limiter = createLimiter(DEMO_LIMITS);

// One call at a time per item: the hash of the last one, until it is final.
const inflight = new Map<string, { hash: string; at: number }>();

async function stillMoving(item: string): Promise<boolean> {
  const last = inflight.get(item);
  if (!last) return false;
  if (Date.now() - last.at > DEMO_LIMITS.sentHoldMs) {
    inflight.delete(item);
    return false;
  }
  try {
    const tx = await rpc<RawTx | null>("eth_getTransactionByHash", [last.hash]);
    if (tx && FINAL_STATUSES.has(statusName(tx.status))) {
      inflight.delete(item);
      return false;
    }
  } catch {
    /* not readable now: still moving, as far as anyone can tell */
  }
  return true;
}

// One signature at a time: two calls signed at once would ask for the same nonce.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

export type ServerAnswer = { status: number; body: { ok: true; hash: string } | { ok: false; reason: string; retryAfter?: number } };

const no = (status: number, reason: string, retryAfter?: number): ServerAnswer => ({ status, body: retryAfter ? { ok: false, reason, retryAfter } : { ok: false, reason } });

async function sign(item: string, functionName: string, args: (string | number)[], value = 0n): Promise<ServerAnswer> {
  const a = demoAccount()!;
  try {
    const hash = await serial(async () => {
      const client = createClient({ chain: studio, account: a });
      return client.writeContract({ address: contractAddress() as Address, functionName, args, value });
    });
    if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("no hash");
    inflight.set(item, { hash, at: Date.now() });
    return { status: 200, body: { ok: true, hash } };
  } catch {
    // Nothing of the error goes out: it is the network's, and it is not the visitor's business.
    return no(502, "Studio did not take the demo bot's call; try again in a minute");
  }
}

type Prepared = { bot: string; item: Item } | ServerAnswer;

/** The checks every demo call shares: online, not asked a moment ago, its last call final, the item read fresh. */
async function prepare(id: string): Promise<Prepared> {
  const s = await demoStatusNow();
  if (!s.online && s.reason !== NOT_POSTED) return no(503, "the demo bot is offline: " + s.reason);
  const turn = limiter.attempt(id, Date.now());
  if (!turn.ok) return no(429, `the demo bot was asked about ${id} a moment ago; try again in ${turn.retryAfter} s`, turn.retryAfter);
  if (await stillMoving(id)) return no(409, `the demo bot is still waiting for its last call on ${id} to be final; try again once it is`);
  let item: Item | null;
  try {
    item = (await readItem(id, { fresh: true })).data;
  } catch {
    return no(502, "could not read the item from Studio; try again in a minute");
  }
  if (!item) return no(404, "no item " + id);
  return { bot: s.bot || demoAccount()!.address.toLowerCase(), item };
}

/** The demo item an item is, when this key owns it under a demo title. */
function ownDemo(bot: string, item: Item): DemoItem | null {
  const d = demoOfTitle(item.title);
  return d && item.owner === bot ? d : null;
}

/** The mark set and salt that open the item's current seal, or null when this key did not make it. */
function currentSeal(d: DemoItem, item: Item): { marks: string; salt: string } | null {
  const salt = demoSalt(demoKey(), d.slug, item.seals);
  const first = setOfSeal(d, item.seals);
  for (const set of [first, ...d.sets.filter((s) => s !== first)]) if (sealOf(set.marks, salt) === item.marksDigest) return { marks: set.marks, salt };
  return null;
}

/** POST /api/demo/reveal: the demo owner reveals the marks and salt of the current seal for the pending claim. */
export async function sendReveal(id: string): Promise<ServerAnswer> {
  const p = await prepare(id);
  if ("status" in p) return p;
  const d = ownDemo(p.bot, p.item);
  if (!d) return no(409, `${id} is not one of the demo owner's items; the demo owner reveals only its own`);
  if (p.item.status !== "claimed" || !p.item.pending) return no(409, `${id} is ${p.item.status} with no claim pending; the demo owner reveals only for a pending claim`);
  if (p.item.defaultable || (p.item.now && p.item.now >= p.item.pending.revealBy))
    return no(409, `the reveal window of ${p.item.pending.id} has closed; anyone may now call default(${id}), which pays the claim`);
  const seal = currentSeal(d, p.item);
  if (!seal) return no(409, `the seal on ${id} was not made by this demo key, so the demo owner cannot open it`);
  return sign(id, "reveal", [id, seal.marks, seal.salt]);
}

/** POST /api/demo/reseal: the demo owner seals the next marks of the item's rotation on an exposed item. */
export async function sendReseal(id: string): Promise<ServerAnswer> {
  const p = await prepare(id);
  if ("status" in p) return p;
  const d = ownDemo(p.bot, p.item);
  if (!d) return no(409, `${id} is not one of the demo owner's items; the demo owner reseals only its own`);
  if (p.item.status !== "exposed") return no(409, `${id} is ${p.item.status}; the demo owner seals new marks only on an item whose last marks were revealed`);
  if (!p.item.resealable) return no(409, `claims on ${id} have closed; the demo owner cannot seal new marks on it`);
  const next = p.item.seals + 1;
  return sign(id, "reseal", [id, sealOf(setOfSeal(d, next).marks, demoSalt(demoKey(), d.slug, next))]);
}

/** POST /api/demo/repost: the demo owner puts a returned demo item back on the shelf as a new item. */
export async function sendRepost(id: string): Promise<ServerAnswer> {
  const p = await prepare(id);
  if ("status" in p) return p;
  const d = ownDemo(p.bot, p.item);
  if (!d) return no(409, `${id} is not one of the demo owner's items; the demo owner reposts only its own`);
  if (p.item.status !== "returned" && p.item.status !== "withdrawn") return no(409, `${id} is ${p.item.status}; the demo owner puts an item back on the shelf only once it was returned`);
  let shelf: DemoShelfItem[];
  try {
    shelf = await shelfOf(p.bot);
  } catch {
    return no(502, "could not read the demo shelf from Studio; try again in a minute");
  }
  const newest = shelf.find((s) => s.slug === d.slug);
  if (newest && newest.item && newest.item !== id) return no(409, `the ${d.slug} is back on the shelf already, as ${newest.item}`);
  const claimBy = Math.floor(Date.now() / 1000) + d.claimAhead;
  return sign(id, "post_lost", [d.title, d.publicDescription, sealOf(setOfSeal(d, 1).marks, demoSalt(demoKey(), d.slug, 1)), d.revealSeconds, claimBy], d.rewardAtto);
}

/** POST /api/demo/claim: the demo finder claims a visitor's open item with one of its three fixed lines. */
export async function sendClaim(id: string, line: FinderLine): Promise<ServerAnswer> {
  const p = await prepare(id);
  if ("status" in p) return p;
  if (p.item.owner === p.bot) return no(409, `${id} is the demo owner's own item; the demo finder claims only items visitors post`);
  if (p.item.status !== "open" || !p.item.claimable) return no(409, `${id} is ${p.item.status}; the demo finder claims only an open item whose claims have not closed`);
  try {
    const claims = (await readClaims(id, 0, 20, { fresh: true })).data;
    const mine = claims.rows.filter((c) => c.finder === p.bot).length;
    if (claims.total <= 20 && mine >= CLAIMS_PER_FINDER) return no(409, `the demo finder has claimed ${id} ${mine} times, the most one address may`);
    const credit = BigInt((await readCredit(p.bot, { fresh: true })).data);
    if (credit < CLAIM_BOND) {
      const topUp = await sign(id, "deposit", [], FINDER_TOP_UP);
      if (!topUp.body.ok) return topUp;
      return no(409, "the demo finder is depositing credit for its claim bond first; ask again once that is final, in about a minute");
    }
  } catch {
    return no(502, "could not read the item's claims from Studio; try again in a minute");
  }
  return sign(id, "claim", [id, finderLine(line)]);
}
