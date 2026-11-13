// Whole items through the in-memory contract of mock mode, from node, with no browser: one visitor plays
// the finder of the three demo items (a match that pays the reward, a no_match that pays the owner the
// bond, an unclear that gives it back, a reseal after each, a default when the owner lets the window
// pass, a repost once an item went home), then plays the owner of items of its own (the demo finder
// claims with its fixed lines; the visitor reveals with the marks and salt it sealed; reseals; takes a
// reward back after claims close), and meets every refusal on the way, word for word. After every step
// no atto is created or lost, and the contract holds exactly what its books say it owes.

import test from "node:test";
import assert from "node:assert/strict";

import * as mock from "../../lib/chain-mock.ts";
import { calls } from "../../lib/calls.ts";
import { DEMO_ITEMS, LOST_MARKS_FIRST, setOfSeal } from "../../lib/demo-items.ts";
import { CLAIM_BOND, GEN } from "../../lib/rules.ts";
import { newSalt, sealOf } from "../../lib/seal.ts";

const { VISITOR, PASSER_BY, DEMO_BOT } = mock;
const [BACKPACK, UMBRELLA, SCARF] = DEMO_ITEMS;
const view = async (fn, args = []) => JSON.parse(await mock.view(fn, args));
const bal = (a) => mock.balanceOf(a);

async function final(hash) {
  for (let i = 0; i < 40; i++) {
    const s = await mock.txStatus(hash);
    if (s.status === "FINALIZED") return s;
  }
  throw new Error("never final: " + hash);
}
async function as(who, call) {
  mock.setMockPersona(who);
  return final(await mock.write(call));
}
async function bot(answer) {
  const a = await answer;
  assert.ok(a.ok, "the demo bot acted: " + (a.ok ? "" : a.reason));
  return final(a.hash);
}
const refused = (s, words) => {
  assert.equal(s.exec, "ERROR", "the call raised");
  assert.ok(s.message.includes("[EXPECTED] " + words), `refused with "${words}", got "${s.message}"`);
};

let total = 0n;
async function world() {
  let sum = mock.mockContractBalance();
  for (const a of mock.ACCOUNTS) sum += await bal(a);
  return sum;
}
async function conserved(step) {
  const { held, balance } = mock.mockHeld();
  assert.equal(held, balance, `${step}: the contract holds exactly what its books owe`);
  assert.equal(await world(), total, `${step}: no atto created or lost`);
  assert.equal(BigInt((await view("stats")).balance_owed), held, `${step}: stats() publishes the sum`);
}

test("the visitor plays the finder of the three demo items, and the owner of its own", async () => {
  await view("stats");
  total = await world();
  await conserved("seeded");

  const shelf = mock.demoStatus().items;
  assert.deepEqual(
    shelf.map((s) => [s.slug, s.item, s.status]),
    [
      ["backpack", "L2", "open"],
      ["umbrella", "L3", "open"],
      ["scarf", "L4", "open"],
    ],
  );

  // Credit first: a claim with none is refused, and says so.
  refused(await as(VISITOR, calls.claim("L2", BACKPACK.sets[0].accurate)), "a claim stakes the claim bond, " + CLAIM_BOND + " atto, from your credit, which holds 0; deposit() it first");
  await as(VISITOR, calls.deposit(GEN / 10n));
  assert.equal((await view("credit", [VISITOR])).credit, (GEN / 10n).toString());
  await conserved("deposit");

  // ---- match: the backpack, the accurate chip ----
  const before = await bal(VISITOR);
  const c1 = await as(VISITOR, calls.claim("L2", BACKPACK.sets[0].accurate));
  assert.equal(c1.result.claim, "C2");
  refused(await as(PASSER_BY, calls.claim("L2", BACKPACK.sets[0].accurate)), "L2 has a claim pending, C2; one claim at a time");
  refused(await as(VISITOR, calls.reveal("L2", BACKPACK.sets[0].marks, "x".repeat(16))), "only the owner of L2 may reveal its hidden marks");
  const r1 = await bot(mock.demoReveal("L2"));
  assert.equal(r1.result.finding, "match");
  assert.equal(r1.result.status, "returned");
  assert.equal((await bal(VISITOR)) - before, BACKPACK.rewardAtto, "the reward reached the finder in the same call");
  const l2 = await view("item", ["L2"]);
  assert.equal(l2.status, "returned");
  assert.equal(l2.revealed_marks, BACKPACK.sets[0].marks);
  assert.equal(l2.sealed, false);
  refused(await as(VISITOR, calls.claim("L2", BACKPACK.sets[0].accurate)), "L2 is returned and takes no claim");
  await conserved("match");

  // ---- the returned backpack goes back on the shelf as a new item ----
  assert.equal((await mock.demoReveal("L2")).ok, false);
  await bot(mock.demoRepost("L2"));
  assert.equal(mock.demoStatus().items[0].item, "L5");
  const again = await mock.demoRepost("L2");
  assert.equal(again.ok, false);
  assert.match(again.reason, /back on the shelf already, as L5/);
  await conserved("repost");

  // ---- no_match: the umbrella, the wrong chip; then the demo owner reseals ----
  const botBefore = await bal(DEMO_BOT);
  await as(VISITOR, calls.claim("L3", UMBRELLA.sets[0].wrong));
  const r2 = await bot(mock.demoReveal("L3"));
  assert.equal(r2.result.finding, "no_match");
  assert.equal(r2.result.bond_to, "owner");
  assert.equal((await bal(DEMO_BOT)) - botBefore, CLAIM_BOND, "the bond reached the owner");
  assert.equal((await view("item", ["L3"])).status, "exposed");
  refused(await as(PASSER_BY, calls.claim("L3", UMBRELLA.sets[0].accurate)), "the hidden marks of L3 were revealed at");
  refused(await as(VISITOR, calls.withdrawReward("L3")), "only the owner of L3 may take its reward back");
  await bot(mock.demoReseal("L3"));
  const l3 = await view("item", ["L3"]);
  assert.equal(l3.status, "open");
  assert.equal(l3.seals, 2);
  assert.equal(l3.marks_digest, sealOf(setOfSeal(UMBRELLA, 2).marks, mock.mockDemoSeal("umbrella", 2)));
  assert.equal((await mock.demoReseal("L3")).ok, false, "an open item is not resealed");
  await conserved("no_match and reseal");

  // ---- unclear: the umbrella's second marks, the vague chip ----
  const credit0 = BigInt((await view("credit", [VISITOR])).credit);
  await as(VISITOR, calls.claim("L3", UMBRELLA.sets[1].vague));
  const r3 = await bot(mock.demoReveal("L3"));
  assert.equal(r3.result.finding, "unclear");
  assert.equal(r3.result.bond_to, "credit");
  assert.equal(BigInt((await view("credit", [VISITOR])).credit), credit0, "the bond is back in the finder's credit");
  await bot(mock.demoReseal("L3"));
  refused(await as(VISITOR, calls.claim("L3", UMBRELLA.sets[2].accurate)), "this address has claimed L3 2 times; one address claims an item at most 2 times");
  await as(PASSER_BY, calls.deposit(GEN / 25n));
  await as(PASSER_BY, calls.claim("L3", UMBRELLA.sets[2].accurate));
  assert.equal((await bot(mock.demoReveal("L3"))).result.finding, "match", "the third marks, a third finder, a match");
  await conserved("unclear, then a match on the third seal");

  // ---- default: the scarf, its owner never reveals ----
  const passer = await bal(PASSER_BY);
  await as(PASSER_BY, calls.claim("L4", SCARF.sets[0].accurate));
  refused(await as(VISITOR, calls.default("L4")), "the reveal window of C6 is open for another");
  mock.advanceClock(601);
  const late = await mock.demoReveal("L4");
  assert.equal(late.ok, false);
  assert.match(late.reason, /reveal window of C6 has closed/);
  const d = await as(VISITOR, calls.default("L4"));
  assert.equal(d.result.finding, "default");
  assert.equal((await bal(PASSER_BY)) - passer, SCARF.rewardAtto, "anyone's default pays only the finder");
  const l4claims = await view("claims_of", ["L4", 0, 20]);
  assert.equal(l4claims.rows[0].finding, "default");
  assert.equal(l4claims.rows[0].marks, "", "a default reveals nothing");
  await conserved("default");

  // ---- the visitor plays the owner: the demo finder claims with its fixed lines ----
  const salt = newSalt();
  const digest = sealOf(LOST_MARKS_FIRST, salt);
  const now = mock.mockNow();
  const p1 = await as(VISITOR, calls.postLost("Brown leather wallet, Quay Road tram", "A brown leather wallet left on a seat of the Quay Road tram, on Tuesday.", digest, 600, now + 7200, GEN / 10n));
  const mine = p1.result.item;
  assert.equal(mine, "L6");
  refused(await as(VISITOR, calls.claim(mine, "It has a library card for Mara Quist and a brass key.")), "the owner of L6 may not claim their own item");
  await bot(mock.demoClaim(mine, "accurate"));
  refused(await as(VISITOR, calls.reveal(mine, LOST_MARKS_FIRST, newSalt())), "these hidden marks and this salt do not match the digest sealed for L6");
  const botMid = await bal(DEMO_BOT);
  const r4 = await as(VISITOR, calls.reveal(mine, LOST_MARKS_FIRST, salt));
  assert.equal(r4.result.finding, "match");
  assert.equal((await bal(DEMO_BOT)) - botMid, GEN / 10n, "the demo finder was paid");
  await conserved("the visitor's item matched");

  const salt2 = newSalt();
  const p2 = await as(VISITOR, calls.postLost("House keys on a blue lanyard, Ferry Pier", "A set of house keys dropped near the ticket office at the Ferry Pier.", sealOf(LOST_MARKS_FIRST, salt2), 600, mock.mockNow() + 7200, GEN / 20n));
  const second = p2.result.item;
  await bot(mock.demoClaim(second, "wrong"));
  const owner0 = await bal(VISITOR);
  const r5 = await as(VISITOR, calls.reveal(second, LOST_MARKS_FIRST, salt2));
  assert.equal(r5.result.finding, "no_match");
  assert.equal((await bal(VISITOR)) - owner0, CLAIM_BOND, "the owner was paid the bond");
  refused(await as(VISITOR, calls.reseal(second, sealOf(LOST_MARKS_FIRST, salt2))), `${second} has sealed this digest before`);
  const fresh = sealOf("a red scarf knotted on the ring; a scratched brass tab; a paper clip on the fob", newSalt());
  assert.equal((await as(VISITOR, calls.reseal(second, fresh))).result.status, "open");
  await conserved("the visitor's item did not match, and was resealed");

  // ---- claims close with nobody claiming: the owner takes the reward back ----
  const p3 = await as(VISITOR, calls.postLost("Small silver camera, Lowbridge Market", "A small silver camera in a grey pouch, left at a fruit stall.", sealOf(LOST_MARKS_FIRST, newSalt()), 600, mock.mockNow() + 700, GEN / 4n));
  const third = p3.result.item;
  refused(await as(VISITOR, calls.withdrawReward(third)), `claims on ${third} are open for another`);
  mock.advanceClock(701);
  refused(await as(PASSER_BY, calls.claim(third, "It is silver and has a strap on it somewhere.")), `claims on ${third} closed at`);
  const back0 = await bal(VISITOR);
  const w = await as(VISITOR, calls.withdrawReward(third));
  assert.equal(w.result.status, "withdrawn");
  assert.equal((await bal(VISITOR)) - back0, GEN / 4n);
  refused(await as(VISITOR, calls.withdrawReward(third)), `${third} is withdrawn; its reward has already left`);
  await conserved("withdraw_reward");

  // ---- refusals that carried value return all of it ----
  const t0 = await bal(VISITOR);
  const small = await as(VISITOR, calls.postLost("Glove, Quay Road", "A grey wool glove dropped on Quay Road on Friday.", digest, 600, mock.mockNow() + 7200, GEN / 100n));
  assert.equal(small.result.ok, false);
  assert.match(small.result.reason, /^send the reward with this call: 50000000000000000 to 50000000000000000000 atto/);
  assert.equal(small.result.returned, (GEN / 100n).toString());
  assert.equal(await bal(VISITOR), t0, "everything sent came back");
  const nothing = await as(VISITOR, calls.deposit(0n));
  assert.equal(nothing.result.ok, false);
  const badDigest = await as(VISITOR, calls.postLost("Glove, Quay Road", "A grey wool glove dropped on Quay Road on Friday.", "not a digest", 600, mock.mockNow() + 7200, GEN / 10n));
  assert.match(badDigest.result.reason, /^the marks digest is sha256\(hidden_marks \+ "\|" \+ salt\)/);
  await conserved("refunds");

  // ---- the finder takes its credit back ----
  const credit = BigInt((await view("credit", [VISITOR])).credit);
  refused(await as(VISITOR, calls.withdraw(credit + 1n)), `withdraw 1 to ${credit} atto`);
  const w0 = await bal(VISITOR);
  await as(VISITOR, calls.withdraw(credit));
  assert.equal((await bal(VISITOR)) - w0, credit);
  refused(await as(VISITOR, calls.withdraw(1n)), "this address holds no credit here");
  await conserved("withdraw");

  const stats = await view("stats");
  assert.deepEqual([stats.matched, stats.no_match, stats.unclear, stats.defaulted, stats.withdrawn], [4, 2, 1, 1, 1]);
  const mineRows = (await view("items_of", [VISITOR, 0, 20])).rows;
  assert.ok(mineRows.some((r) => r.role === "owner") && mineRows.some((r) => r.role === "finder"), "items_of lists both roles");
});
