// Opens the demo on a deployed Found It contract, once: checks the demo bot's key, funds it from Studio's
// faucet, deposits a little credit for the demo finder's claim bonds, and posts the three demo items
// (lib/demo-items.ts) with their first mark sets sealed under salts made from the key. Run it by hand
// after the contract is deployed; nothing in the build runs it.
//
//   REGISTER=0x... DEMO_OWNER_KEY=0x... node tools/open-demo.mjs
//   DRY=1 REGISTER=0x... node tools/open-demo.mjs          # check and print every call, send nothing
//
// The key is a throwaway Studio test key, the same one the site's server holds in DEMO_OWNER_KEY; it is
// read from the environment only and never printed. A demo item already on the shelf (open, claimed or
// exposed) is kept and not posted again. Each transaction is followed to a final status. Needs Node
// 22.18 or later (it reads lib/*.ts directly).

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { getAddress } from "viem";

import { cleanKey, keyProblem } from "../lib/demo-key.ts";
import { DEMO_ITEMS, FINDER_TOP_UP, demoSalt, setOfSeal } from "../lib/demo-items.ts";
import { CLAIM_BOND, MAX_REVEAL, MIN_REVEAL, MIN_REWARD, MAX_REWARD, descriptionProblem, marksProblem, publicProblem, titleProblem } from "../lib/rules.ts";
import { sealOf } from "../lib/seal.ts";

const RPC = "https://studio.genlayer.com/api";
const EXPLORER = "https://explorer-studio.genlayer.com";
const studio = { ...studionet, rpcUrls: { ...studionet.rpcUrls, default: { http: [RPC] } } };

const REGISTER = (process.env.REGISTER || "").trim();
const DRY = process.env.DRY === "1";
const fail = (message) => {
  console.error(message);
  process.exit(2);
};
if (!/^0x[0-9a-fA-F]{40}$/.test(REGISTER)) fail("REGISTER must be the deployed contract's 0x address.");
const problem = keyProblem(process.env.DEMO_OWNER_KEY);
if (!DRY && problem) fail(`DEMO_OWNER_KEY: ${problem}.`);
const key = problem ? "" : cleanKey(process.env.DEMO_OWNER_KEY);

// Every text the bot will ever sign must pass the contract's doors.
for (const d of DEMO_ITEMS) {
  const why = titleProblem(d.title) || publicProblem(d.publicDescription);
  if (why) fail(`${d.slug}: ${why}`);
  if (d.rewardAtto < MIN_REWARD || d.rewardAtto > MAX_REWARD) fail(`${d.slug}: the reward is outside 0.05 to 50 GEN`);
  if (d.revealSeconds < MIN_REVEAL || d.revealSeconds > MAX_REVEAL) fail(`${d.slug}: the reveal window is outside ten minutes to seven days`);
  for (const s of d.sets) {
    const m = marksProblem(s.marks) || descriptionProblem(s.accurate) || descriptionProblem(s.vague) || descriptionProblem(s.wrong);
    if (m) fail(`${d.slug}: ${m}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpc(method, params) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const body = await res.json();
      if (body.error) {
        await sleep(res.status === 429 || body.error.code === -32029 ? 20_000 : 5000);
        continue;
      }
      return body.result;
    } catch {
      await sleep(4000);
    }
  }
  throw new Error(`${method} did not answer`);
}

/** Follows a transaction to a final status; returns the contract's JSON return. */
async function follow(hash) {
  for (let i = 0; i < 300; i++) {
    await sleep(4000);
    const tx = await rpc("eth_getTransactionByHash", [hash]);
    const status = String(tx?.status ?? "");
    if (status === "FINALIZED" || status === "CANCELED" || status === "UNDETERMINED") {
      const lr = tx.consensus_data?.leader_receipt;
      const one = Array.isArray(lr) ? lr[0] : lr;
      let text = "";
      try {
        text = Buffer.from(one?.result ?? "", "base64").toString("utf8");
      } catch {
        text = "";
      }
      const start = text.indexOf("{");
      try {
        return { status, json: start >= 0 ? JSON.parse(text.slice(start, text.lastIndexOf("}") + 1)) : null };
      } catch {
        return { status, json: null };
      }
    }
  }
  throw new Error(`${hash} was not final within twenty minutes`);
}

const reader = createClient({ chain: studio });
const view = async (fn, args) => {
  for (let i = 0; i < 8; i++) {
    try {
      return JSON.parse(String(await reader.readContract({ address: REGISTER, functionName: fn, args })));
    } catch {
      await sleep(5000);
    }
  }
  throw new Error(`the view ${fn} did not answer`);
};

const now = Math.floor(Date.now() / 1000);
const plan = DEMO_ITEMS.map((d) => {
  const marks = setOfSeal(d, 1).marks;
  const digest = key ? sealOf(marks, demoSalt(key, d.slug, 1)) : "(made from the key)";
  return { d, args: [d.title, d.publicDescription, digest, d.revealSeconds, now + d.claimAhead] };
});

if (DRY) {
  console.log(`DRY RUN against ${REGISTER}${key ? `, as ${createAccount(key).address}` : ", no key given"}`);
  console.log(`deposit() with ${FINDER_TOP_UP} atto, if the bot's credit holds less than one bond (${CLAIM_BOND} atto)`);
  for (const p of plan) console.log(`post_lost(${p.args.map((a) => JSON.stringify(a)).join(", ")}) with ${p.d.rewardAtto} atto`);
  process.exit(0);
}

const account = createAccount(key);
const bot = account.address;
const client = createClient({ chain: studio, account });
console.log(`the demo bot is ${bot}`);

// 1. GEN to sign with.
const balance = BigInt((await rpc("eth_getBalance", [bot, "latest"])) || "0x0");
if (balance < 2n * 10n ** 18n) {
  await rpc("sim_fundAccount", { account_address: getAddress(bot), amount: 20e18 });
  console.log("asked Studio's faucet for 20 GEN");
  await sleep(6000);
}

// 2. Credit for the demo finder's claim bonds.
const credit = BigInt((await view("credit", [bot.toLowerCase()])).credit || "0");
if (credit < CLAIM_BOND) {
  const hash = await client.writeContract({ address: REGISTER, functionName: "deposit", args: [], value: FINDER_TOP_UP });
  const r = await follow(hash);
  console.log(`deposit: ${r.status} ${JSON.stringify(r.json)} ${EXPLORER}/tx/${hash}`);
} else console.log(`credit already ${credit} atto; no deposit`);

// 3. The three items, each unless one of its kind is already on the shelf.
const mine = await view("items_of", [bot.toLowerCase(), 0, 20]);
const live = new Set((mine.rows || []).filter((r) => r.role === "owner" && ["open", "claimed", "exposed"].includes(r.status)).map((r) => r.title));
for (const p of plan) {
  if (live.has(p.d.title)) {
    console.log(`${p.d.slug}: already on the shelf; kept`);
    continue;
  }
  const args = [p.args[0], p.args[1], p.args[2], p.args[3], Math.floor(Date.now() / 1000) + p.d.claimAhead];
  const hash = await client.writeContract({ address: REGISTER, functionName: "post_lost", args, value: p.d.rewardAtto });
  const r = await follow(hash);
  if (!r.json?.ok) fail(`${p.d.slug}: post_lost was not taken: ${r.status} ${JSON.stringify(r.json)} ${EXPLORER}/tx/${hash}`);
  console.log(`${p.d.slug}: posted as ${r.json.item} ${EXPLORER}/tx/${hash}`);
}
console.log("done. GET /api/demo/status on the site should now say online.");
