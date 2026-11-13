/* Found It against GenLayer Studio (chain 61999), with throwaway accounts. Deploys its own copy.
 *
 *   npm ci                                                  # genlayer-js 1.1.8 and viem 2.56.8
 *   node tests/on_chain/smoke.mjs                           # the whole run, from a fresh state
 *   RESUME=1 node tests/on_chain/smoke.mjs                  # continue a run that was cut off
 *   STATE=/some/dir/run.json RESUME=1 node tests/on_chain/smoke.mjs   # the same, with the state kept elsewhere
 *
 * Four generated accounts play the story, known only by their roles: OWNER lost a navy backpack on the
 * number 12 bus, a black umbrella on the Quay Road tram and a grey wool scarf at a cafe; FINDER has the
 * backpack and the umbrella; GUESSER has never seen the backpack and tries for its reward twice; STRANGER
 * holds nothing and tries what it may not.
 *
 *   1  deploy Found It.
 *   2  FINDER and GUESSER each deposit 0.04 GEN of credit, two claim bonds. OWNER posts with 0.01 GEN, under
 *      the 0.05 GEN floor, and is refused with every atto returned. OWNER posts L1, the backpack, with a 0.5
 *      GEN reward and seal A ("a library card for Mara Quist in the front pocket; a spare door key on a blue
 *      lanyard"); L2, the umbrella, 0.2 GEN, with the shortest reveal window, ten minutes; L3, the scarf, 0.1
 *      GEN, whose claims close twenty minutes later. OWNER tries to take L3's reward back at once: refused.
 *   3  FINDER claims L2, describing the carved JQ on the handle and the paper clip on the rib. OWNER never
 *      answers. STRANGER tries to default it at once: refused, the reveal window is open.
 *   4  GUESSER claims L1: "A red tag reading HARBOUR and a library card for Ines Corrie". STRANGER tries to
 *      claim it too (refused, one claim at a time) and to reveal it (refused, only the owner). OWNER reveals
 *      seal A; the code checks the digest; one consensus round reads the card as contradicted: no_match, and
 *      GUESSER's 0.02 GEN bond reaches OWNER in the same transaction.
 *   5  seal A is public now. STRANGER copies it into a claim: refused, the item takes no claim until its owner
 *      seals new marks. OWNER reseals L1 with seal B (a broken zip pull tied with yellow string; a heron
 *      sticker on the laptop sleeve). GUESSER claims "It is a blue bag with some stuff inside"; OWNER reveals
 *      seal B: no_match, too general, and the bond reaches OWNER.
 *   6  OWNER reseals L1 with seal C (a red luggage tag reading TIDEPOOL; a cracked green water bottle in the
 *      side pocket; a folded bus map of Lowbridge). GUESSER tries a third claim: refused, two per address.
 *      FINDER claims "It has a red tag that says TIDEPOOL and a green bottle with a crack in the side pocket";
 *      OWNER reveals seal C: match, and the 0.5 GEN reward reaches FINDER in the same transaction, the bond
 *      back in credit. FINDER claims again: refused, L1 is returned.
 *   7  L2's reveal window passes on the chain's own clock and STRANGER defaults it: the 0.2 GEN reward
 *      reaches FINDER as if it matched. L3's claim deadline passes with nobody claiming and OWNER takes its
 *      0.1 GEN back. FINDER withdraws the two bonds that came back to credit.
 *   8  the views read back, the code deployed compared with the file byte for byte, the contract's balance
 *      read, and every account's net movement checked against what the receipts say.
 *
 * Every refusal is a signed transaction. Balances are read after finalisation, because a transfer lands at
 * FINALIZED, not at ACCEPTED. Transactions are polled with eth_getTransactionByHash, never with views. A
 * reveal no majority carried stores nothing and, since reveal() carries no value, strands nothing; it is sent
 * again within the window and both transactions are kept. Every step is saved as it is made, so a run cut off
 * part way continues without sending anything twice. Every id (L1 to L3, C1 to C4, the contract address) is
 * read from the receipt that created it, never assumed; a step whose receipt does not carry the id it needs
 * stops the run rather than guess. Waits are measured on the chain's own clock: the item and stats views
 * report the message clock as `now`. A whole run takes about 35 to 55 minutes: one deployment and 27
 * transactions, three of them consensus rounds of four askings each.
 *
 * A state file remembers the sha256 of the contract it deployed, and a RESUME against a state made from
 * another file stops before sending anything.
 */
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { generatePrivateKey } from "viem/accounts";
import { getAddress } from "viem";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RPC = "https://studio.genlayer.com/api";
const STATE = process.env.STATE || join(tmpdir(), "found-it-smoke-state.json");
const RECORD = process.env.RECORD || STATE.replace(/\.json$/, "") + "-record.json";
const FILE = new URL("../../contracts/found_it.py", import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 19);
const rpc = async (m, p) => {
  let last;
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }) });
      const j = await r.json();
      if (j.error && (j.error.code === -32029 || r.status === 429)) { await sleep(((j.error.data?.retry_after_seconds) || 20) * 1000); continue; }
      if (j.error) { last = new Error(m + ": " + JSON.stringify(j.error).slice(0, 200)); await sleep(6000); continue; }
      return j.result;
    } catch (e) { last = e; await sleep(4000); }
  }
  throw last;
};
let pass = 0, fail = 0;
const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  - " + d : ""}`); return !!c; };
const GEN = 10n ** 18n;
const tally = (v) => `${v.agree} agree, ${v.disagree} disagree, ${v.idle} idle`;
const sha = (b) => createHash("sha256").update(b).digest("hex");
const need = (v, what) => { if (!v) { console.log(`stopping: ${what} was not in the receipt; nothing is assumed`); process.exit(2); } return v; };

// ---------- state: keys, addresses and every step already made survive a cut-off run ----------
const st = existsSync(STATE) && process.env.RESUME ? JSON.parse(readFileSync(STATE, "utf8")) : {};
st.keys = st.keys || {}; st.steps = st.steps || {}; st.views = st.views || {}; st.order = st.order || []; st.ids = st.ids || {}; st.when = st.when || {};
const SOURCE_SHA = sha(readFileSync(FILE));
if (st.source_sha256 && st.source_sha256 !== SOURCE_SHA) {
  console.log(`the state file ${STATE} belongs to a run of another contract file; start a fresh run without RESUME, or name another STATE`);
  process.exit(2);
}
st.source_sha256 = SOURCE_SHA;
// 32 hexadecimal characters each, letters and digits only, revealed on chain with their seals
st.salts = st.salts || { a: randomBytes(16).toString("hex"), b: randomBytes(16).toString("hex"), c: randomBytes(16).toString("hex"), umbrella: randomBytes(16).toString("hex"), scarf: randomBytes(16).toString("hex") };
const save = () => {
  writeFileSync(STATE, JSON.stringify(st, null, 1));
  const { keys, salts, ...shown } = st;     // the record carries no key, and no salt of a seal never revealed
  writeFileSync(RECORD, JSON.stringify({ ...shown, salts_revealed: { a: salts.a, b: salts.b, c: salts.c } }, null, 1));
};
const ROLES = {
  owner: "lost a backpack, an umbrella and a scarf; posts them, reveals, reseals, takes back an unclaimed reward",
  finder: "has the backpack and the umbrella, and describes their hidden marks",
  guesser: "has never seen the backpack, and tries for its reward twice",
  stranger: "holds nothing; copies revealed marks, claims out of turn, reveals another's item, defaults the umbrella",
};
for (const k of Object.keys(ROLES)) st.keys[k] = st.keys[k] || generatePrivateKey();
const acct = {}, client = {};
for (const k of Object.keys(ROLES)) { acct[k] = createAccount(st.keys[k]); client[k] = createClient({ chain: studionet, account: acct[k] }); }
const rd = createClient({ chain: studionet });
st.accounts = Object.fromEntries(Object.keys(ROLES).map((k) => [k, getAddress(acct[k].address)]));
const low = (a) => String(a).toLowerCase();
save();

const balance = async (a) => BigInt(await rpc("eth_getBalance", [a, "latest"]) || "0x0");
const nonceOf = async (a) => Number(BigInt(await rpc("eth_getTransactionCount", [a, "latest"]) || "0x0"));
const fundOnce = async (k, whole) => {
  st.funded = st.funded || {};
  if (st.funded[k]) return;
  await rpc("sim_fundAccount", { account_address: getAddress(acct[k].address), amount: whole * 1e18 });   // checksummed; amount in atto, as a number
  for (let i = 0; i < 20 && (await balance(acct[k].address)) === 0n; i++) await sleep(3000);
  st.funded[k] = String(await balance(acct[k].address)); save();
};

// ---------- transactions ----------
const errText = (e) => String(e?.details || e?.shortMessage || e?.cause?.message || e?.message || e);
// A request the network refused or never received is made again. When the failure is ambiguous the
// sender's nonce says whether the transaction landed after all, and its hash is read back, so nothing is
// ever sent twice.
const sendRaw = async (who, what, make) => {
  const addr = acct[who].address;
  for (let i = 0; ; i++) {
    const n0 = await nonceOf(addr);
    try { return await make(); } catch (e) {
      if (i >= 8) throw e;
      console.log(`      ${what} was not taken (${errText(e).slice(0, 70)}); looking again in 20s`);
      await sleep(20000);
      if ((await nonceOf(addr)) > n0) {
        const list = await rpc("sim_getTransactionsForAddress", [addr]);
        const hit = (list || []).find((t) => low(t.from_address) === low(addr) && Number(t.nonce) === n0);
        if (hit?.hash) return hit.hash;
        throw new Error(what + " landed but its hash could not be read back");
      }
    }
  }
};
const countVotes = (t) => { let a = 0, d = 0, idl = 0; for (const k in (t.consensus_data?.votes || {})) { const v = t.consensus_data.votes[k]; if (v === "agree") a++; else if (v === "disagree") d++; else idl++; } return { agree: a, disagree: d, idle: idl }; };
const wait = async (tx) => {
  let stuck = 0;
  for (let i = 0; i < 900; i++) {
    await sleep(4000);
    const t = await rpc("eth_getTransactionByHash", [tx]);
    if (t?.status === "FINALIZED") {
      const lr = t.consensus_data?.leader_receipt, one = Array.isArray(lr) ? lr[0] : lr;
      let msg = "";
      try { msg = Buffer.from(one.result, "base64").toString("utf8").replace(/[^\x20-\x7e]/g, " ").trim(); } catch (e) {}
      const v = countVotes(t);
      return { tx, msg, exec: one?.execution_result || "", votes: v, applied: v.agree * 2 > v.agree + v.disagree + v.idle, address: t.data?.contract_address || t.to_address || "" };
    }
    // a round no majority carried is final as it stands once it has been left alone for ten minutes
    if (t?.status === "UNDETERMINED" && (stuck = stuck + 1) > 150) return { tx, msg: "UNDETERMINED", exec: "", votes: countVotes(t), applied: false, address: "" };
    if (t?.status === "CANCELED") return { tx, msg: "CANCELED", exec: "", votes: { agree: 0, disagree: 0, idle: 0 }, applied: false, address: "" };
    if (i > 0 && i % 75 === 0) console.log(`      [${stamp()}] still ${t?.status || "unknown"} after ${Math.round(i * 4 / 60)} minutes: ${tx}`);
  }
  return { tx, msg: "TIMEOUT", exec: "", votes: { agree: 0, disagree: 0, idle: 0 }, applied: false, address: "" };
};
const jsonOf = (msg) => { const b = String(msg).indexOf("{"); if (b === -1) return null; try { return JSON.parse(String(msg).slice(b)); } catch (e) { return null; } };
const settle = async (a, before, want) => { for (let i = 0; i < 45; i++) { const b = await balance(a); if (b - before === want) return b; await sleep(4000); } return await balance(a); };

// One step: a signed transaction, its tally, what it returned, and the balances it moved. opt.watch names
// the roles whose balances are read before and after, opt.expect the change each should show (a table, or
// a function of what the call returned), and opt.again how long to wait before sending a refused step again.
const call = async (id, who, fn, args = [], opt = {}) => {
  if (!st.steps[id]) { st.steps[id] = { id, who, fn, args: args.map(String), value: String(opt.value || 0n), tries: [] }; st.order.push(id); }
  const rec = st.steps[id];
  if (!rec.done) {
    if (!rec.before) { rec.before = {}; for (const k of opt.watch || []) rec.before[k] = String(await balance(acct[k].address)); save(); }
    for (;;) {
      if (!rec.pending) { rec.pending = await sendRaw(who, fn, () => client[who].writeContract({ address: need(st.contract, "the contract address"), functionName: fn, args, ...(opt.value ? { value: opt.value } : {}) })); save(); }
      const r = await wait(rec.pending);
      rec.tries.push({ tx: r.tx, votes: r.votes, exec: r.exec, applied: r.applied, msg: r.msg });
      rec.pending = null; save();
      console.log(`      [${stamp()}] ${who.toUpperCase()} ${fn}(${args.map((x) => String(x).slice(0, 22)).join(", ")})${opt.value ? " +" + Number(opt.value) / 1e18 + " GEN" : ""}  ${r.tx}  ${tally(r.votes)}  ${r.exec}`);
      if (r.msg === "TIMEOUT" || rec.tries.length >= 4) break;
      if (!r.applied) { console.log("      the validators did not carry that round (" + tally(r.votes) + "), so nothing was stored; sending it again"); continue; }
      const again = opt.again ? opt.again(r) : 0;
      if (again > 0) { console.log(`      not yet; waiting ${Math.round(again / 1000)} s and sending it again`); await sleep(again); continue; }
      break;
    }
    const last = rec.tries[rec.tries.length - 1];
    const expect = typeof opt.expect === "function" ? opt.expect(jsonOf(last.msg)) : opt.expect;
    rec.after = {}; rec.delta = {};
    for (const k of opt.watch || []) {
      const before = BigInt(rec.before[k]);
      const want = expect && expect[k] !== undefined ? BigInt(expect[k]) : null;
      const now = want === null ? await balance(acct[k].address) : await settle(acct[k].address, before, want);
      rec.after[k] = String(now); rec.delta[k] = String(now - before);
    }
    rec.done = true; save();
  }
  const last = rec.tries[rec.tries.length - 1];
  return { ...last, j: jsonOf(last.msg), tries: rec.tries, delta: rec.delta || {} };
};
const refused = (r, words) => r.exec === "ERROR" && r.msg.includes(words);
const moved = (r, k, want) => r.delta[k] === String(want);
const votes = (r) => r.tries.map((t) => tally(t.votes)).join(", then ");

const deploy = async (id, who) => {
  if (!st.steps[id]) { st.steps[id] = { id, who, fn: "deploy contracts/found_it.py", args: [], value: "0", tries: [] }; st.order.push(id); }
  const rec = st.steps[id];
  if (!rec.done) {
    const code = readFileSync(FILE);
    for (;;) {
      if (!rec.pending) { rec.pending = await sendRaw(who, "deploy", () => client[who].deployContract({ code, args: [], leaderOnly: false })); save(); }
      const r = await wait(rec.pending);
      rec.tries.push({ tx: r.tx, votes: r.votes, exec: r.exec, applied: r.applied, msg: r.msg.slice(0, 300) });
      rec.address = r.address; rec.pending = null; save();
      console.log(`      [${stamp()}] ${who.toUpperCase()} deploy  ${r.tx}  ${tally(r.votes)}  ${r.exec}  ${r.address}`);
      if (r.applied || r.msg === "TIMEOUT" || rec.tries.length >= 3) break;
    }
    rec.done = true; save();
  }
  return need(rec.address, "the address of the deployed contract");
};

// ---------- reads: paced, and made again on a 429 instead of failing ----------
let lastRead = 0;
const read = async (fn, args = []) => {
  for (let i = 0; i < 30; i++) {
    const gap = 3500 - (Date.now() - lastRead);
    if (gap > 0) await sleep(gap);
    lastRead = Date.now();
    try { return JSON.parse(String(await rd.readContract({ address: st.contract, functionName: fn, args }))); } catch (e) {
      if (i === 29) return { error: "VIEW ERROR " + fn + ": " + errText(e).slice(0, 100) };
      await sleep(/rate|429|limit/i.test(errText(e)) ? 25000 : 10000);
    }
  }
};
// a view read once for a check is kept with the run, so a continued run checks what was seen then
const seen = async (id, fn, args = []) => { if (!st.views[id]) { st.views[id] = { fn, args, when: stamp(), out: await read(fn, args) }; save(); } return st.views[id].out; };
// the chain's own clock: the stats view reports the message clock as `now`, and this machine's clock stands in
// only when a read carries none
const chainNow = async () => { const s = await read("stats", []); return Number(s.now > 0 ? s.now : Math.floor(Date.now() / 1000)); };
// an instant fixed once, the first time a step needs it, so a continued run sends the same arguments
const fixed = async (id, ahead) => { if (!st.when[id]) { st.when[id] = (await chainNow()) + ahead; save(); } return st.when[id]; };
// wait, by the chain's own clock, until an instant has passed
const untilPast = async (instant, what) => {
  for (let i = 0; i < 40; i++) {
    const left = Number(instant) - (await chainNow());
    if (left < -10) return;
    console.log(`      [${stamp()}] waiting ${left + 20} s, by the chain clock, for ${what}`);
    await sleep((left + 20) * 1000);
  }
};
const notYet = (r) => { const m = /open for another (\d+) seconds/.exec(r.msg); return r.exec === "ERROR" && m ? (Number(m[1]) + 15) * 1000 : 0; };

// ---------- the demonstration ----------
const BOND = GEN / 50n, REWARD = GEN / 2n, REWARD2 = GEN / 5n, REWARD3 = GEN / 10n, SHORT = GEN / 100n;
// The suite reads these out of this file and checks they are the texts it judges.
const TITLE = "Navy backpack, number 12 bus";
const PUBLIC = "A navy blue backpack lost on the number 12 bus on 3 March";
const SEAL_A = "a library card for Mara Quist in the front pocket; a spare door key on a blue lanyard";
const SEAL_B = "a broken zip pull on the front pocket tied with yellow string; a sticker of a grey heron on the laptop sleeve";
const SEAL_C = "a red luggage tag reading TIDEPOOL; a cracked green water bottle in the side pocket; a folded bus map of Lowbridge in the inner pocket";
const WRONG_TEXT = "A red tag reading HARBOUR and a library card for Ines Corrie";
const GENERAL_TEXT = "It is a blue bag with some stuff inside";
const FINDER_TEXT = "It has a red tag that says TIDEPOOL and a green bottle with a crack in the side pocket";
const UMBRELLA = "Black umbrella, Quay Road tram";
const UMBRELLA_PUBLIC = "A black folding umbrella left on the Quay Road tram on 9 March";
const UMBRELLA_MARKS = "a wooden handle carved with the initials JQ; a bent rib held straight with a paper clip";
const UMBRELLA_TEXT = "The wooden handle has JQ carved into it and one rib is held with a paper clip";
const SCARF = "Grey wool scarf, Harbour Lane cafe";
const SCARF_PUBLIC = "A grey wool scarf left at the Harbour Lane cafe on 10 March";
const SCARF_MARKS = "a darned hole near one end in red thread; a laundry label marked AQ";
const seal = (marks, salt) => sha(marks + "|" + salt);
const finderOf = {};   // claim id -> the role that made it, read off the claim receipts

await fundOnce("owner", 2); await fundOnce("finder", 1); await fundOnce("guesser", 1); await fundOnce("stranger", 1);
if (!st.start) { st.start = {}; for (const k of Object.keys(ROLES)) st.start[k] = String(await balance(acct[k].address)); st.started = new Date().toISOString(); save(); }
console.log(`[${stamp()}] ${Object.keys(ROLES).map((k) => k.toUpperCase().padEnd(9) + " " + st.accounts[k] + "  " + ROLES[k]).join("\n           ")}\n           state ${STATE}`);

// ================================================================ 1
console.log(`\n[${stamp()}] ---- 1: deploy`);
st.contract = st.contract || await deploy("deploy", "owner");
save();
console.log(`      Found It at ${st.contract}`);
{
  const s = await seen("statsEmpty", "stats", []);
  ok("Found It is deployed and holds nothing yet", s.items === 0 && s.balance_owed === "0", JSON.stringify(s));
}

// ================================================================ 2
console.log(`\n[${stamp()}] ---- 2: the claim bonds, a refused post, and three lost items`);
{
  for (const who of ["finder", "guesser"]) {
    const d = await call("deposit_" + who, who, "deposit", [], { value: 2n * BOND, watch: [who], expect: { [who]: -2n * BOND } });
    ok(`${who.toUpperCase()} deposits 0.04 GEN of credit, two claim bonds; no model runs`, d.j?.ok === true && d.j?.credit === String(2n * BOND) && moved(d, who, -2n * BOND), votes(d));
  }
  const by1 = await fixed("postL1", 3 * 3600);
  const short = await call("postShort", "owner", "post_lost", [TITLE, PUBLIC, seal(SEAL_A, st.salts.a), 1800, by1], { value: SHORT, watch: ["owner"], expect: { owner: 0n } });
  ok("OWNER posts with 0.01 GEN, under the 0.05 GEN floor: refused, and every atto comes back in the same transaction", short.exec !== "ERROR" && short.j?.ok === false && String(short.j?.reason).includes("send the reward") && short.j?.returned === String(SHORT) && moved(short, "owner", 0n), `${votes(short)}  ${short.msg.slice(0, 140)}`);
  const p1 = await call("postL1", "owner", "post_lost", [TITLE, PUBLIC, seal(SEAL_A, st.salts.a), 1800, by1], { value: REWARD, watch: ["owner"], expect: { owner: -REWARD } });
  ok("OWNER posts L1, the navy backpack, with a 0.5 GEN reward and seal A; no model runs", p1.j?.ok === true && p1.j?.reward === String(REWARD) && moved(p1, "owner", -REWARD), `${votes(p1)}  ${p1.msg.slice(0, 140)}`);
  st.ids.L1 = need(p1.j?.item, "the backpack's item id"); save();
  const by2 = await fixed("postL2", 3 * 3600);
  const p2 = await call("postL2", "owner", "post_lost", [UMBRELLA, UMBRELLA_PUBLIC, seal(UMBRELLA_MARKS, st.salts.umbrella), 600, by2], { value: REWARD2, watch: ["owner"], expect: { owner: -REWARD2 } });
  ok("OWNER posts L2, the black umbrella, 0.2 GEN, with a ten-minute reveal window", p2.j?.ok === true && p2.j?.reveal_seconds === 600 && moved(p2, "owner", -REWARD2), `${votes(p2)}  ${p2.msg.slice(0, 140)}`);
  st.ids.L2 = need(p2.j?.item, "the umbrella's item id"); save();
  const by3 = await fixed("postL3", 1200);
  const p3 = await call("postL3", "owner", "post_lost", [SCARF, SCARF_PUBLIC, seal(SCARF_MARKS, st.salts.scarf), 1800, by3], { value: REWARD3, watch: ["owner"], expect: { owner: -REWARD3 } });
  ok("OWNER posts L3, the grey wool scarf, 0.1 GEN, claims closing twenty minutes on", p3.j?.ok === true && moved(p3, "owner", -REWARD3), `${votes(p3)}  ${p3.msg.slice(0, 140)}`);
  st.ids.L3 = need(p3.j?.item, "the scarf's item id"); st.ids.L3_claim_by = need(p3.j?.claim_by, "the scarf's claim deadline"); save();
  ok("the three item ids are read from the receipts, and differ", [st.ids.L1, st.ids.L2, st.ids.L3].every((x) => /^L\d+$/.test(x)) && new Set([st.ids.L1, st.ids.L2, st.ids.L3]).size === 3, `${st.ids.L1} ${st.ids.L2} ${st.ids.L3}`);
  const early = await call("withdrawL3Early", "owner", "withdraw_reward", [st.ids.L3], { watch: ["owner"], expect: { owner: 0n } });
  ok(`OWNER tries to take ${st.ids.L3}'s reward back at once: refused, its claims are still open`, refused(early, "are open for another") && moved(early, "owner", 0n), `${votes(early)}  ${early.msg.slice(0, 120)}`);
  const row = await seen("L1open", "item", [st.ids.L1]);
  ok(`item(${st.ids.L1}): open, the public description, the digest of seal A, no marks shown`, row.status === "open" && row.public_description === PUBLIC && row.marks_digest === seal(SEAL_A, st.salts.a) && row.revealed_marks === "" && row.sealed === true, JSON.stringify({ status: row.status, sealed: row.sealed }));
}

// ================================================================ 3
console.log(`\n[${stamp()}] ---- 3: FINDER claims the umbrella, and OWNER never answers`);
{
  const c = await call("claimL2", "finder", "claim", [st.ids.L2, UMBRELLA_TEXT], { watch: ["finder"], expect: { finder: 0n } });
  ok(`FINDER claims ${st.ids.L2}: the bond leaves credit, no model runs, the reveal window opens`, c.j?.ok === true && c.j?.bond === String(BOND) && c.j?.credit === String(BOND), `${votes(c)}  ${c.msg.slice(0, 140)}`);
  st.ids.C_umbrella = need(c.j?.claim, "the umbrella claim's id"); st.ids.C_umbrella_reveal_by = need(c.j?.reveal_by, "its reveal deadline"); save();
  const early = await call("defaultL2Early", "stranger", "default", [st.ids.L2]);
  ok(`STRANGER tries to default ${st.ids.L2} at once: refused, the reveal window is open`, refused(early, "is open for another"), `${votes(early)}  ${early.msg.slice(0, 120)}`);
}
finderOf[st.ids.C_umbrella] = "finder";

// ================================================================ 4
console.log(`\n[${stamp()}] ---- 4: GUESSER's first claim on the backpack, judged against seal A`);
{
  const L1 = st.ids.L1;
  const g = await call("claimGuessWrong", "guesser", "claim", [L1, WRONG_TEXT]);
  ok(`GUESSER claims ${L1}: a red tag reading HARBOUR, a library card for Ines Corrie`, g.j?.ok === true && g.j?.credit === String(BOND), `${votes(g)}  ${g.msg.slice(0, 120)}`);
  st.ids.C_wrong = need(g.j?.claim, "GUESSER's first claim id"); save();
  const turn = await call("claimStrangerPending", "stranger", "claim", [L1, FINDER_TEXT]);
  ok(`STRANGER claims ${L1} too: refused, one claim at a time`, refused(turn, "one claim at a time"), `${votes(turn)}  ${turn.msg.slice(0, 120)}`);
  const sr = await call("revealByStranger", "stranger", "reveal", [L1, SEAL_A, st.salts.a]);
  ok(`STRANGER tries to reveal ${L1} with the right marks and salt: refused, only the owner may`, refused(sr, "only the owner of " + L1 + " may reveal"), `${votes(sr)}  ${sr.msg.slice(0, 120)}`);
  const r = await call("revealA", "owner", "reveal", [L1, SEAL_A, st.salts.a], { watch: ["owner", "guesser"], expect: (j) => ({ owner: j?.bond_to === "owner" ? BOND : 0n, guesser: 0n }) });
  ok("OWNER reveals seal A; one consensus round of four askings reads the card as contradicted: no_match", r.j?.finding === "no_match" && r.j?.status === "exposed", `${votes(r)}  ${r.j?.finding || r.msg.slice(0, 100)}`);
  ok("and GUESSER's 0.02 GEN bond reaches OWNER in the same transaction", r.j?.bond_to === "owner" && moved(r, "owner", BOND) && moved(r, "guesser", 0n), JSON.stringify(r.delta));
}
finderOf[st.ids.C_wrong] = "guesser";

// ================================================================ 5
console.log(`\n[${stamp()}] ---- 5: seal A is public; a copy is refused; seal B judges GUESSER's second claim`);
{
  const L1 = st.ids.L1;
  const copy = await call("claimCopy", "stranger", "claim", [L1, "It has " + SEAL_A]);
  ok(`STRANGER copies the revealed seal A into a claim: refused, ${L1} takes no claim until its owner seals new marks`, refused(copy, "are public"), `${votes(copy)}  ${copy.msg.slice(0, 140)}`);
  const rs = await call("resealB", "owner", "reseal", [L1, seal(SEAL_B, st.salts.b)]);
  ok(`OWNER reseals ${L1} with seal B; it is open again`, rs.j?.ok === true && rs.j?.seals === 2 && rs.j?.status === "open", `${votes(rs)}  ${rs.msg.slice(0, 120)}`);
  const g = await call("claimGuessGeneral", "guesser", "claim", [L1, GENERAL_TEXT]);
  ok(`GUESSER claims ${L1} again: it is a blue bag with some stuff inside`, g.j?.ok === true && g.j?.credit === "0", `${votes(g)}  ${g.msg.slice(0, 120)}`);
  st.ids.C_general = need(g.j?.claim, "GUESSER's second claim id"); save();
  const r = await call("revealB", "owner", "reveal", [L1, SEAL_B, st.salts.b], { watch: ["owner"], expect: (j) => ({ owner: j?.bond_to === "owner" ? BOND : 0n }) });
  ok("OWNER reveals seal B: no_match, too general to name any mark", r.j?.finding === "no_match", `${votes(r)}  ${r.j?.finding || r.msg.slice(0, 100)}`);
  ok("and the second 0.02 GEN bond reaches OWNER in the same transaction", r.j?.bond_to === "owner" && moved(r, "owner", BOND), JSON.stringify(r.delta));
}
finderOf[st.ids.C_general] = "guesser";

// ================================================================ 6
console.log(`\n[${stamp()}] ---- 6: seal C, a third claim refused, and FINDER's description judged`);
{
  const L1 = st.ids.L1;
  const rs = await call("resealC", "owner", "reseal", [L1, seal(SEAL_C, st.salts.c)]);
  ok(`OWNER reseals ${L1} with seal C`, rs.j?.ok === true && rs.j?.seals === 3, `${votes(rs)}  ${rs.msg.slice(0, 120)}`);
  const third = await call("claimGuessThird", "guesser", "claim", [L1, FINDER_TEXT]);
  ok("GUESSER tries a third claim: refused, one address claims an item at most twice", refused(third, "at most 2 times"), `${votes(third)}  ${third.msg.slice(0, 140)}`);
  const f = await call("claimFinder", "finder", "claim", [L1, FINDER_TEXT]);
  ok(`FINDER claims ${L1}: a red tag that says TIDEPOOL, a green bottle with a crack in the side pocket`, f.j?.ok === true && f.j?.credit === "0", `${votes(f)}  ${f.msg.slice(0, 120)}`);
  st.ids.C_finder = need(f.j?.claim, "FINDER's claim id"); save();
  const r = await call("revealC", "owner", "reveal", [L1, SEAL_C, st.salts.c], { watch: ["finder", "owner"], expect: (j) => ({ finder: BigInt(j?.reward || "0"), owner: 0n }) });
  ok("OWNER reveals seal C: the description names the tag and the bottle and contradicts nothing, match", r.j?.finding === "match" && r.j?.status === "returned", `${votes(r)}  ${r.j?.finding || r.msg.slice(0, 100)}`);
  ok("and the 0.5 GEN reward reaches FINDER in the same transaction, the bond back in credit", r.j?.reward === String(REWARD) && r.j?.credit === String(BOND) && moved(r, "finder", REWARD) && moved(r, "owner", 0n), JSON.stringify(r.delta));
  const again = await call("claimFinderAgain", "finder", "claim", [L1, FINDER_TEXT]);
  ok(`FINDER claims ${L1} again: refused, it is returned`, refused(again, L1 + " is returned and takes no claim"), `${votes(again)}  ${again.msg.slice(0, 120)}`);
}
finderOf[st.ids.C_finder] = "finder";

// ================================================================ 7
console.log(`\n[${stamp()}] ---- 7: the umbrella defaulted, the scarf's reward taken back, the bonds withdrawn`);
{
  if (!st.steps.defaultL2?.done) await untilPast(st.ids.C_umbrella_reveal_by, `the reveal window of ${st.ids.C_umbrella}`);
  const d = await call("defaultL2", "stranger", "default", [st.ids.L2], { watch: ["finder", "owner", "stranger"], expect: { finder: REWARD2, owner: 0n, stranger: 0n }, again: notYet });
  ok(`STRANGER defaults ${st.ids.L2}: OWNER never revealed, so the 0.2 GEN reward reaches FINDER as if it matched`, d.j?.finding === "default" && d.j?.reward === String(REWARD2) && moved(d, "finder", REWARD2) && moved(d, "stranger", 0n), `${votes(d)}  ${JSON.stringify(d.delta)}`);
  if (!st.steps.withdrawL3?.done) await untilPast(st.ids.L3_claim_by, `the claim deadline of ${st.ids.L3}`);
  const w = await call("withdrawL3", "owner", "withdraw_reward", [st.ids.L3], { watch: ["owner"], expect: { owner: REWARD3 }, again: notYet });
  ok(`OWNER takes ${st.ids.L3}'s 0.1 GEN back: its claim deadline passed with nobody claiming`, w.j?.ok === true && w.j?.returned === String(REWARD3) && moved(w, "owner", REWARD3), `${votes(w)}  ${w.msg.slice(0, 120)}`);
  const held = BigInt((await seen("creditFinder", "credit", [acct.finder.address])).credit || "0");
  const out = await call("withdrawFinder", "finder", "withdraw", [String(held)], { watch: ["finder"], expect: { finder: held } });
  ok("FINDER withdraws the two 0.02 GEN bonds that came back to credit", out.j?.ok === true && held === 2n * BOND && moved(out, "finder", held), `${votes(out)}  ${out.msg.slice(0, 80)}`);
}

// ================================================================ 8
console.log(`\n[${stamp()}] ---- 8: the views, the code, and the money`);
{
  const L1 = st.ids.L1;
  const row = await seen("L1", "item", [L1]);
  ok(`item(${L1}): returned by FINDER's claim, three seals, seal C's marks and salt shown`, row.status === "returned" && row.seals === 3 && row.revealed_marks === SEAL_C && row.revealed_salt === st.salts.c && row.returned_by === st.ids.C_finder && row.no_match === 2 && row.matched === 1, JSON.stringify({ status: row.status, seals: row.seals, claims: row.claims }));
  const page = await seen("claimsL1", "claims_of", [L1, 0, 20]);
  const rows = page.rows || [];
  ok(`claims_of(${L1}, 0, 20): three claims, each with the marks it was judged against`, page.total === 3 && rows.length === 3 && rows[0].finding === "no_match" && rows[0].marks === SEAL_A && rows[1].finding === "no_match" && rows[1].marks === SEAL_B && rows[2].finding === "match" && rows[2].marks === SEAL_C && rows[2].description === FINDER_TEXT, JSON.stringify(rows.map((r) => r.finding)));
  const l2 = await seen("L2", "item", [st.ids.L2]);
  ok(`item(${st.ids.L2}): returned by default, its marks never revealed`, l2.status === "returned" && l2.defaulted === 1 && l2.revealed_marks === "" && l2.sealed === true, JSON.stringify({ status: l2.status, defaulted: l2.defaulted }));
  const mine = await seen("itemsOfFinder", "items_of", [acct.finder.address, 0, 20]);
  ok("items_of(FINDER): the backpack and the umbrella, as finder", mine.total === 2 && (mine.rows || []).every((r) => r.role === "finder"), JSON.stringify(mine.rows?.map((r) => r.item + " " + r.role)));
  const all = await seen("items", "items", [0, 20]);
  ok("items(0, 20): three items, returned, returned, withdrawn", all.total === 3 && JSON.stringify((all.rows || []).map((r) => r.status)) === JSON.stringify(["returned", "returned", "withdrawn"]), JSON.stringify(all.rows?.map((r) => r.status)));
  const credits = [];
  for (const k of ["finder", "guesser", "stranger"]) credits.push(await seen("credit_" + k, "credit", [acct[k].address]));
  ok("credit() is zero for every claimant: nothing is left held for anybody", credits.every((c) => c.credit === "0"), JSON.stringify(credits.map((c) => c.credit)));
  const stats = await seen("stats", "stats", []);
  ok("stats(): three items, four claims, one match, two no_match, one default, two reseals, nothing held", stats.items === 3 && stats.claims === 4 && stats.matched === 1 && stats.no_match === 2 && stats.defaulted === 1 && stats.reseals === 2 && stats.refunds === 1 && stats.balance_owed === "0", JSON.stringify(stats));
  const rules = await seen("rules", "rules", []);
  ok("rules(): the four questions word for word, four askings, the combine rule and the limits", String(rules.questions?.matches?.names_two).includes("correctly name at least two of the HIDDEN MARKS") && String(rules.questions?.guess?.something_wrong).includes("contradicts the HIDDEN MARKS") && rules.askings?.length === 4 && String(rules.compared).includes("exact string equality") && String(rules.limits?.[0]).includes("cannot see the item"), Object.keys(rules).join(","));
  ok("the contract's own balance is zero", (await balance(st.contract)) === 0n, String(await balance(st.contract)));

  const bytes = readFileSync(FILE);
  const chain = Buffer.from(String(await rpc("gen_getContractCode", [st.contract])), "base64");
  st.code = { address: st.contract, bytes: chain.length, sha256: sha(chain), file_bytes: bytes.length, file_sha256: sha(bytes), identical: Buffer.compare(chain, bytes) === 0 };
  save();
  ok(`the code deployed at ${st.contract} is byte for byte contracts/found_it.py`, st.code.identical, `${chain.length} bytes, sha256 ${st.code.sha256}`);

  st.end = {}; for (const k of Object.keys(ROLES)) st.end[k] = String(await balance(acct[k].address));
  st.ended = new Date().toISOString(); save();
  // what each account should have gained or lost, read off the receipts: a deposit takes its value and a
  // withdrawal returns it; a post takes the reward and withdraw_reward returns it; a reveal pays the reward to
  // the claim's finder or the bond to the owner; a default pays the reward to the claim's finder
  const want = Object.fromEntries(Object.keys(ROLES).map((k) => [k, 0n]));
  for (const id of st.order) {
    const s = st.steps[id], j = jsonOf(s.tries.at(-1)?.msg || "");
    if (!j?.ok) continue;
    if (s.fn === "deposit") want[s.who] -= BigInt(j.deposited);
    if (s.fn === "withdraw") want[s.who] += BigInt(j.returned);
    if (s.fn === "post_lost") want[s.who] -= BigInt(j.reward);
    if (s.fn === "withdraw_reward") want[s.who] += BigInt(j.returned);
    if (s.fn === "reveal" || s.fn === "default") { want[need(finderOf[j.claim], "the finder of " + j.claim)] += BigInt(j.reward); if (j.bond_to === "owner") want.owner += BigInt(j.bond); }
  }
  const net = (k) => BigInt(st.end[k]) - BigInt(st.start[k]);
  ok("over the run every account ends exactly where the receipts say: FINDER 0.7 GEN up, GUESSER 0.04 GEN down, OWNER 0.66 GEN down", Object.keys(want).every((k) => net(k) === want[k]) && want.finder === REWARD + REWARD2 && want.guesser === -2n * BOND && want.owner === 2n * BOND - REWARD - REWARD2 && want.stranger === 0n, Object.keys(want).map((k) => k.toUpperCase() + " " + Number(net(k)) / 1e18 + " (receipts " + Number(want[k]) / 1e18 + ")").join("  "));
}

st.checks = { pass, fail }; save();
console.log(`\n${pass} passed, ${fail} failed`);
console.log("Found It:", st.contract);
console.log("transactions:", st.order.reduce((n, id) => n + st.steps[id].tries.length, 0), "in", st.order.length, "steps; sent a second time:", st.order.filter((id) => st.steps[id].tries.length > 1).join(", ") || "none");
for (const id of st.order) { const s = st.steps[id], j = jsonOf(s.tries.at(-1)?.msg || ""); if (j?.finding) console.log(`${id.padEnd(18)} ${s.tries.map((t) => t.tx + " " + tally(t.votes)).join(" | ")}  ${j.claim} ${j.finding}`); }
console.log("record:", RECORD);
process.exit(fail ? 1 : 0);
