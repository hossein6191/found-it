// Chain access for Found It: the ONE file that knows the contract's interface.
//
// Every method name, argument order, view shape and outcome word of contracts/found_it.py that the site
// depends on is written here (and the call builders in lib/calls.ts); when the contract's interface
// changes, this is the file to edit, with lib/chain-mock.ts, which stands in for the contract in mock
// mode and answers in the contract's own JSON so the mappers below run in both modes.
//
// Reads go through readContract (gen_call) with the retry policy in lib/rpc.ts: eight tries over about
// forty seconds, because Studio answers "Contract not found" for a healthy contract for about a minute
// after a deploy. A failed read is never "no data" and never proof that a write failed. Studio allows 30
// gen_call a minute from one browser (the faucet shares them), so every view answer is cached for 30 s,
// two components asking for the same view share one request, and invalidateReads() drops the cache once
// a transaction is final.

import * as mock from "./chain-mock";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { getAddress, type Address } from "viem";
import { notify } from "./browser-store";
import { contractAddress } from "./config";
import { RATE_LIMITED, createReadCache, decodeTx, isMissingMethodError, noteFailure, rpc, sleep, waitForCooldown, withRetry, type RawTx } from "./rpc";
import { FINDINGS, PAGE, STATUSES, idNumber, sentence, type BondTo, type Finding, type ItemStatus } from "./rules";
import type { Arg, Call, Claim, DemoAnswer, DemoShelfItem, DemoStatus, Item, ItemRow, MyRow, Paged, ReadResult, Rules, Stats, TxStatus, WriteFn } from "./types";
import { chainName, getChainId, getSigner } from "./wallet";

export { RATE_LIMITED, cooldownRemainingMs } from "./rpc";
export { contractAddress };
export { calls } from "./calls";

export const CHAIN_ID = 61999;
export const RPC_URL = "https://studio.genlayer.com/api";
export const EXPLORER_URL = "https://explorer-studio.genlayer.com";

export const isMock = process.env.NEXT_PUBLIC_MOCK === "1";

export const NETWORK_ERROR = "could not reach the network";
export const NO_CONTRACT = "the contract is not deployed yet";
export const FAUCET_REFUSED = "Studio refused the faucet request (it allows 30 requests a minute from one browser). Try again in a minute.";

export const hasContract = (): boolean => isMock || !!contractAddress();
export const contractInUse = (): string => (isMock ? mock.MOCK_CONTRACT : contractAddress());

// The SDK's studionet object carries another explorer URL; the RPC and explorer hosts are set here.
export const studio = {
  ...studionet,
  rpcUrls: { ...studionet.rpcUrls, default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "GenLayer Studio Explorer", url: EXPLORER_URL } },
};

const reader = () => createClient({ chain: studio });

type Row = Record<string, unknown>;

const num = (v: unknown, dflt = 0): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : dflt;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return Number(v);
  return dflt;
};
const str = (v: unknown, dflt = ""): string => (v === undefined || v === null ? dflt : String(v));
const atto = (v: unknown): string => {
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? BigInt(Math.trunc(v)).toString() : "0";
  const s = str(v, "0").trim();
  return /^\d+$/.test(s) ? s : "0";
};
const addr = (v: unknown): string => str(v).toLowerCase();
/** Seconds; the contract writes -1 or 0 when a call had no readable clock. */
const secs = (v: unknown): number => Math.max(0, num(v));
const asRow = (v: unknown): Row => (v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {});
const rowsOf = (v: unknown): Row[] => (Array.isArray(v) ? v.filter((r): r is Row => !!r && typeof r === "object" && !Array.isArray(r)) : []);

function parseView(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

export const READ_TTL_MS = 30_000;
const onServer = typeof window === "undefined";
const views = createReadCache<unknown>(onServer ? 0 : READ_TTL_MS);

let moved = 0;
/** How many times the chain has moved under this page: a stable snapshot. */
export const chainVersion = (): number => moved;

/** Forget every cached view answer, and tell the lists on screen to read again. */
export const invalidateReads = () => {
  views.clear();
  moved++;
  notify();
};

async function view(fn: string, args: Arg[] = [], opts: { fresh?: boolean } = {}): Promise<unknown> {
  if (isMock) return parseView(await mock.view(fn, args));
  const address = contractAddress();
  if (!address) throw new Error(NO_CONTRACT);
  const key = `${address.toLowerCase()}|${fn}|${JSON.stringify(args)}`;
  if (opts.fresh) views.forget(key);
  try {
    const raw = await views.get(key, () =>
      withRetry(() => reader().readContract({ address: address as Address, functionName: fn, args }), {
        bucket: "gen",
        giveUp: isMissingMethodError,
      }),
    );
    return parseView(raw);
  } catch (e) {
    if (e instanceof Error && e.message === RATE_LIMITED) throw e;
    throw new Error(NETWORK_ERROR);
  }
}

const browserNow = (): number => (isMock ? mock.mockNow() : Math.floor(Date.now() / 1000));
const SOURCE: ReadResult<unknown>["source"] = isMock ? "mock" : "chain";
const result = <T>(data: T): ReadResult<T> => ({ data, source: SOURCE });

// ---- row mappers (every missing field gets a default) -----------------------------------------------

const status = (v: unknown): ItemStatus => (STATUSES.includes(str(v) as ItemStatus) ? (str(v) as ItemStatus) : "open");
const finding = (v: unknown): Finding => {
  const s = str(v);
  return (FINDINGS as readonly string[]).includes(s) || s === "default" ? (s as Finding) : "";
};
const bondTo = (v: unknown): BondTo => (str(v) === "credit" ? "credit" : str(v) === "owner" ? "owner" : "");
const hex64 = (v: unknown): string => (/^[0-9a-f]{64}$/.test(str(v)) ? str(v) : "");

export function mapClaim(r: Row): Claim {
  return {
    id: str(r.claim),
    item: str(r.item),
    finder: addr(r.finder),
    number: num(r.number),
    description: str(r.description),
    at: secs(r.at),
    revealBy: secs(r.reveal_by),
    digest: hex64(r.digest),
    status: str(r.status) === "settled" ? "settled" : "pending",
    finding: finding(r.finding),
    marks: str(r.marks),
    rewardAtto: atto(r.reward),
    bondAtto: atto(r.bond),
    bondTo: bondTo(r.bond_to),
    settledAt: secs(r.settled_at),
    why: str(r.why),
  };
}

export function mapItem(r: Row, id = ""): Item {
  const p = asRow(r.pending);
  return {
    id: str(r.item ?? id),
    owner: addr(r.owner),
    title: str(r.title),
    publicDescription: str(r.public_description),
    rewardAtto: atto(r.reward),
    claimBondAtto: atto(r.claim_bond),
    revealSeconds: num(r.reveal_seconds),
    postedAt: secs(r.posted_at),
    claimBy: secs(r.claim_by),
    status: status(r.status),
    marksDigest: hex64(r.marks_digest),
    seals: num(r.seals, 1),
    sealed: r.sealed === true,
    pending: p.claim ? mapClaim(p) : null,
    revealedMarks: str(r.revealed_marks),
    revealedSalt: str(r.revealed_salt),
    revealedDigest: hex64(r.revealed_digest),
    revealedAt: secs(r.revealed_at),
    claims: num(r.claims),
    matched: num(r.matched),
    noMatch: num(r.no_match),
    unclear: num(r.unclear),
    defaulted: num(r.defaulted),
    returnedBy: str(r.returned_by),
    closedAt: secs(r.closed_at),
    now: secs(r.now),
    readAt: 0,
    claimable: r.claimable === true,
    defaultable: r.defaultable === true,
    resealable: r.resealable === true,
    withdrawable: r.withdrawable === true,
  };
}

const mapItemRow = (r: Row): ItemRow => ({ id: str(r.item), owner: addr(r.owner), title: str(r.title), status: status(r.status), rewardAtto: atto(r.reward), claimBy: secs(r.claim_by), claims: num(r.claims) });
const mapMyRow = (r: Row): MyRow => ({ id: str(r.item), role: str(r.role) === "finder" ? "finder" : "owner", title: str(r.title), status: status(r.status), rewardAtto: atto(r.reward), claims: num(r.claims) });

export function mapStats(r: Row): Stats {
  return {
    items: num(r.items),
    returned: num(r.returned),
    withdrawn: num(r.withdrawn),
    claims: num(r.claims),
    matched: num(r.matched),
    noMatch: num(r.no_match),
    unclear: num(r.unclear),
    defaulted: num(r.defaulted),
    reseals: num(r.reseals),
    refunds: num(r.refunds),
    creditsHeldAtto: atto(r.credits_held),
    rewardsHeldAtto: atto(r.rewards_held),
    bondsHeldAtto: atto(r.bonds_held),
    rewardsPaidAtto: atto(r.rewards_paid),
    bondsToOwnersAtto: atto(r.bonds_to_owners),
    rewardsBackAtto: atto(r.rewards_back),
    balanceOwedAtto: atto(r.balance_owed),
    now: secs(r.now),
  };
}

const paged = <T>(value: Row, map: (r: Row) => T): Paged<T> => {
  if (!Array.isArray(value.rows)) throw new Error(NETWORK_ERROR);
  return { total: num(value.total), offset: num(value.offset), limit: num(value.limit, PAGE), rows: rowsOf(value.rows).map(map) };
};

// ---- reads: one function per view ---------------------------------------------------------------------

type Fresh = { fresh?: boolean };
const pageArgs = (offset: number, limit: number): [number, number] => [Math.max(0, Math.trunc(offset)), Math.max(1, Math.min(PAGE, Math.trunc(limit)))];

/** item(id): null when the contract holds no such item. Its row carries the view's own clock. */
export async function readItem(id: string, opts: Fresh = {}): Promise<ReadResult<Item | null>> {
  const value = asRow(await view("item", [id], opts));
  if ("error" in value || !value.owner) return result(null);
  return result({ ...mapItem(value, id), readAt: browserNow() });
}

/** items(offset, limit): one page of every item, oldest first. */
export async function readItems(offset = 0, limit = PAGE, opts: Fresh = {}): Promise<ReadResult<Paged<ItemRow>>> {
  return result(paged(asRow(await view("items", pageArgs(offset, limit), opts)), mapItemRow));
}

/** items_of(address, offset, limit): one page of the items an address posted or claimed, with its role. */
export async function readItemsOf(address: string, offset = 0, limit = PAGE, opts: Fresh = {}): Promise<ReadResult<Paged<MyRow>>> {
  return result(paged(asRow(await view("items_of", [address.toLowerCase(), ...pageArgs(offset, limit)], opts)), mapMyRow));
}

/** claims_of(item, offset, limit): one page of an item's claims, oldest first. */
export async function readClaims(id: string, offset = 0, limit = PAGE, opts: Fresh = {}): Promise<ReadResult<Paged<Claim>>> {
  const value = asRow(await view("claims_of", [id, ...pageArgs(offset, limit)], opts));
  if ("error" in value) return result({ total: 0, offset: 0, limit: PAGE, rows: [] });
  return result(paged(value, mapClaim));
}

/** The newest claims of an item first: its last page, then the page before it. */
export async function readClaimsNewest(id: string, total: number, opts: Fresh = {}): Promise<ReadResult<Claim[]>> {
  if (total <= 0) return result([]);
  const start = Math.max(0, total - PAGE);
  const rows = (await readClaims(id, start, PAGE, opts)).data.rows;
  return result([...rows].sort((a, b) => b.number - a.number));
}

/** credit(address): what an address holds as credit for claim bonds. */
export async function readCredit(address: string, opts: Fresh = {}): Promise<ReadResult<string>> {
  return result(atto(asRow(await view("credit", [address.toLowerCase()], opts)).credit));
}

async function newestFirst<T extends { id: string }>(read: (offset: number) => Promise<Paged<T>>, maxPages: number): Promise<{ total: number; rows: T[]; partial: boolean }> {
  const first = await read(0);
  const pages = Math.ceil(first.total / PAGE);
  const rows = [...first.rows];
  for (let p = pages - 1, k = 1; p >= 1 && k < maxPages; p--, k++) rows.push(...(await read(p * PAGE)).rows);
  const unique = new Map(rows.map((r) => [r.id, r]));
  return { total: first.total, rows: [...unique.values()].sort((a, b) => idNumber(b.id) - idNumber(a.id)), partial: pages > maxPages };
}

export async function readItemsWindow(maxPages = 3, opts: Fresh = {}): Promise<ReadResult<{ total: number; rows: ItemRow[]; partial: boolean }>> {
  return result(await newestFirst(async (o) => (await readItems(o, PAGE, opts)).data, maxPages));
}

export async function readItemsOfWindow(address: string, maxPages = 3, opts: Fresh = {}): Promise<ReadResult<{ total: number; rows: MyRow[]; partial: boolean }>> {
  return result(await newestFirst(async (o) => (await readItemsOf(address, o, PAGE, opts)).data, maxPages));
}

export async function readStats(opts: Fresh = {}): Promise<ReadResult<Stats>> {
  return result(mapStats(asRow(await view("stats", [], opts))));
}

export async function readRules(): Promise<ReadResult<Rules>> {
  return result(asRow(await view("rules", [])));
}

// ---- writes ----------------------------------------------------------------------------------------

/** True for the one call the validators judge with their models: the rail then shows their votes. */
export const isJudged = (fn: WriteFn) => fn === "reveal";

const WRONG_CHAIN = (chainId: number | null) => `Your wallet is on ${chainName(chainId)}. Switch it to GenLayer Studio (chain 61999) before signing.`;

/** Sends a call through the connected EIP-1193 provider. Resolves to the transaction hash. */
export async function write(call: Call): Promise<string> {
  if (isMock) return mock.write(call);
  const address = contractAddress();
  if (!address) throw new Error("The contract is not deployed yet, so there is nothing to sign.");
  const signer = getSigner();
  if (!signer) throw new Error("Connect a wallet first.");
  // Studio is gasless and the SDK skips its own chain check for it, so the refusal to sign on another
  // chain lives here, and it says which chain the wallet is on.
  const chainId = await getChainId(signer.provider);
  if (chainId !== CHAIN_ID) throw new Error(WRONG_CHAIN(chainId));
  const client = createClient({ chain: studio, account: signer.address as Address, provider: signer.provider });
  const hash = await client.writeContract({ address: address as Address, functionName: call.fn, args: call.args, value: call.value ?? 0n });
  if (typeof hash !== "string" || !hash.startsWith("0x")) throw new Error("The wallet returned no transaction hash.");
  return hash;
}

// ---- outcomes: what a finished call's JSON return means ---------------------------------------------

/** True when the leader's return is what the chain stored. */
export const stored = (s: TxStatus | null): s is TxStatus => !!s && !s.undetermined && s.applied !== false && s.status !== "CANCELED";

export function errorTag(s: TxStatus | null): "EXPECTED" | "TRANSIENT" | "LLM_ERROR" | "" {
  const m = /\[(EXPECTED|TRANSIENT|LLM_ERROR)\]/.exec(s?.message || "");
  return m ? (m[1] as "EXPECTED" | "TRANSIENT" | "LLM_ERROR") : "";
}

function raisedSentence(s: TxStatus): string {
  const m = /\[(?:EXPECTED|TRANSIENT|LLM_ERROR)\]\s*([^"}\n]+)/.exec(s.message || "");
  return m ? sentence(m[1]) : "";
}

/** The contract's reason for refusing a call, as a sentence; "" when the call was not refused. */
export function refusalReason(s: TxStatus | null): string {
  if (!s) return "";
  const r = s.result;
  if (r && r.ok === false) return sentence(str(r.reason));
  if (s.exec === "ERROR" && !s.undetermined) return raisedSentence(s) || sentence(s.message || "");
  return "";
}

export function succeeded(s: TxStatus | null): boolean {
  return !!s && s.status === "FINALIZED" && stored(s) && s.exec !== "ERROR" && s.result?.ok !== false;
}

/** A plain sentence for a tx that finished without doing what was asked; "" when it did. */
export function failureOf(s: TxStatus | null): string {
  if (!s) return "";
  if (s.undetermined) {
    const why = errorTag(s) ? raisedSentence(s) : "";
    return why
      ? `${why} The validators did not agree on a value, so nothing was stored and no money moved; the claim is still pending.`
      : "The validators did not reach a majority, so nothing was stored and no money moved. Sending the same call again is safe.";
  }
  if (s.status === "CANCELED") return "The network cancelled the transaction. Nothing was stored.";
  const reason = refusalReason(s);
  if (reason) return reason;
  if (s.applied === false) return "The validators did not accept this transaction. Nothing was stored.";
  return "";
}

const ok = (s: TxStatus | null): s is TxStatus & { result: Row } => stored(s) && s.result?.ok === true;

/** post_lost()'s return: the new item's id, or "". */
export const postedItem = (s: TxStatus | null): string => (ok(s) && /^L\d+$/.test(str(s.result.item)) ? str(s.result.item) : "");

/** claim()'s return: the new claim's id, or "". */
export const madeClaim = (s: TxStatus | null): string => (ok(s) && /^C\d+$/.test(str(s.result.claim)) ? str(s.result.claim) : "");

export type Settled = { claim: string; item: string; finding: Exclude<Finding, "">; status: ItemStatus; rewardAtto: string; bondAtto: string; bondTo: BondTo; creditAtto: string; why: string };

/** reveal()'s or default()'s return: the finding and where the money went. */
export function settledOutcome(s: TxStatus | null): Settled | null {
  if (!ok(s)) return null;
  const f = finding(s.result.finding);
  if (!f) return null;
  const r = s.result;
  return { claim: str(r.claim), item: str(r.item), finding: f, status: status(r.status), rewardAtto: atto(r.reward), bondAtto: atto(r.bond), bondTo: bondTo(r.bond_to), creditAtto: atto(r.credit), why: str(r.why) };
}

export type Refund = { reason: string; returnedAtto: string };
/** A refused deposit or post_lost: why, and what came back in the same transaction. */
export function refundOf(s: TxStatus | null): Refund | null {
  if (!stored(s) || !s.result || s.result.ok !== false) return null;
  return { reason: sentence(str(s.result.reason)), returnedAtto: atto(s.result.returned) };
}

/** True when GEN moves to or from somebody's wallet because of this call, so balances are watched afterwards. */
export function movesMoney(s: TxStatus): boolean {
  const r = s.result;
  if (!r) return false;
  if (r.ok === false) return atto(r.returned) !== "0";
  if (r.ok !== true) return false;
  return atto(r.reward) !== "0" || atto(r.returned) !== "0" || str(r.bond_to) === "owner";
}

// ---- the demo bot ----------------------------------------------------------------------------------

let demoCache: { at: number; value: DemoStatus } | null = null;

/** Whether the demo bot can act now, its items and whether it can claim. Asked of the site's own server; cached 20 s. */
export async function readDemoStatus(opts: Fresh = {}): Promise<DemoStatus> {
  if (isMock) return mock.demoStatus();
  if (!opts.fresh && demoCache && Date.now() - demoCache.at < 20_000) return demoCache.value;
  try {
    const res = await fetch("/api/demo/status", { cache: "no-store" });
    const body = (await res.json()) as Partial<DemoStatus>;
    const items: DemoShelfItem[] = Array.isArray(body.items)
      ? body.items
          .filter((i): i is DemoShelfItem => !!i && typeof i === "object")
          .map((i) => ({ slug: str(i.slug), item: /^L[1-9]\d{0,8}$/.test(str(i.item)) ? str(i.item) : "", status: STATUSES.includes(str(i.status) as ItemStatus) ? (str(i.status) as ItemStatus) : "" }))
      : [];
    const value: DemoStatus = { online: body.online === true, bot: addr(body.bot), reason: str(body.reason), items, finder: body.finder === true, finderReason: str(body.finderReason) };
    demoCache = { at: Date.now(), value };
    return value;
  } catch {
    return { online: false, bot: "", reason: "the site's server did not answer", items: [], finder: false, finderReason: "" };
  }
}

async function askDemo(path: string, body: Record<string, string>): Promise<DemoAnswer> {
  demoCache = null;
  try {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const answer = (await res.json()) as Record<string, unknown>;
    if (answer.ok === true && typeof answer.hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(answer.hash)) return { ok: true, hash: answer.hash };
    return { ok: false, reason: sentence(str(answer.reason, "the demo bot did not answer")), retryAfter: num(answer.retryAfter) || undefined };
  } catch {
    return { ok: false, reason: "The site's server did not answer. Try again in a minute." };
  }
}

const mockAnswer = async (p: Promise<DemoAnswer>): Promise<DemoAnswer> => {
  const a = await p;
  return a.ok ? a : { ok: false, reason: sentence(a.reason) };
};

/** The demo owner reveals its marks and salt for the claim pending on one of its items. */
export const requestDemoReveal = (item: string): Promise<DemoAnswer> => (isMock ? mockAnswer(mock.demoReveal(item)) : askDemo("/api/demo/reveal", { item }));
/** The demo owner seals fresh marks on one of its items that a judged claim left exposed. */
export const requestDemoReseal = (item: string): Promise<DemoAnswer> => (isMock ? mockAnswer(mock.demoReseal(item)) : askDemo("/api/demo/reseal", { item }));
/** The demo owner posts a returned demo item again. */
export const requestDemoRepost = (item: string): Promise<DemoAnswer> => (isMock ? mockAnswer(mock.demoRepost(item)) : askDemo("/api/demo/repost", { item }));
/** The demo finder claims a visitor's item with one of its three fixed lines. Nothing the visitor types goes with it. */
export const requestDemoClaim = (item: string, line: string): Promise<DemoAnswer> => (isMock ? mockAnswer(mock.demoClaim(item, line)) : askDemo("/api/demo/claim", { item, line }));

// ---- transactions, balances, the faucet -------------------------------------------------------------

export async function txStatus(hash: string): Promise<TxStatus> {
  if (isMock) return mock.txStatus(hash);
  const tx = await withRetry(() => rpc<RawTx | null>("eth_getTransactionByHash", [hash]), { tries: 2, bucket: "eth", ownBudget: true });
  return decodeTx(tx);
}

export async function balanceOf(address: string): Promise<bigint> {
  if (isMock) return mock.balanceOf(address);
  const hex = await withRetry(() => rpc<string>("eth_getBalance", [address, "latest"]), { tries: 3, bucket: "eth", ownBudget: true });
  return BigInt(hex || "0x0");
}

const FAUCET_PAUSE_MS = 10_000;
const FAUCET_TRIES = 3;
const FAUCET_WAIT_MS = 60_000;

/** Faucet: sim_fundAccount with 10 GEN, up to three tries ten seconds apart. Resolves when the balance moved. */
export async function faucet(address: string, opts: { stillWanted?: () => boolean } = {}): Promise<bigint> {
  if (isMock) return mock.faucet(address);
  // Studio credits only a checksummed address: the lowercase spelling is accepted and never paid.
  let account: string;
  try {
    account = getAddress(address);
  } catch {
    throw new Error("That is not a valid 0x address, so the faucet was not asked.");
  }
  let before: bigint;
  try {
    before = await balanceOf(account);
  } catch {
    throw new Error("Could not read this wallet's balance from Studio, so the faucet was not asked. Try again in a few seconds.");
  }
  let sent = false;
  for (let i = 0; i < FAUCET_TRIES && !sent; i++) {
    await waitForCooldown("gen");
    try {
      // `amount` is wei as a JS number; a decimal string makes the node compare str with int.
      await rpc("sim_fundAccount", { account_address: account, amount: 10e18 });
      sent = true;
    } catch (e) {
      noteFailure(e, Date.now(), "gen");
      if (i === FAUCET_TRIES - 1) throw new Error(FAUCET_REFUSED);
      await sleep(FAUCET_PAUSE_MS);
    }
  }
  const started = Date.now();
  while (Date.now() - started < FAUCET_WAIT_MS) {
    await sleep(2000);
    if (opts.stillWanted && !opts.stillWanted()) throw new Error("The faucet wait ended: the wallet switched accounts.");
    try {
      const now = await balanceOf(account);
      if (now !== before) return now;
    } catch {
      /* a dropped poll is not a failed faucet; keep polling */
    }
  }
  throw new Error("The faucet did not credit the account within 60 s. Try again.");
}

export const txUrl = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER_URL}/address/${address}`;
export const itemPath = (id: string) => `/item/${id}`;
