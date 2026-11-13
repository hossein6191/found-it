// The waiting copy for every state an item can be in, for each of the three people looking at it, for
// a demo item and an ordinary one, on chain and in the demo build: five lines, each a sentence, the
// money with its amount, "you must act" said only where something must be done, and "you can leave"
// false only where leaving loses something. Then every wait the site itself causes.

import test from "node:test";
import assert from "node:assert/strict";

import { ITEM_STATES, ROLES, demoGuide, itemGuide, sendingGuide, signGuide, stateOf } from "../../lib/guide.ts";
import { GEN } from "../../lib/rules.ts";

const NOW = 1_800_000_000;
const ctx = (demo, mock) => ({ reward: (GEN / 10n).toString(), now: NOW, claimBy: NOW + 7 * 86400, revealSeconds: 600, revealBy: NOW + 300, demo, mock, myClaims: 1, closedAt: NOW - 60 });
const sentence = (s) => typeof s === "string" && s.length > 8 && /^[A-Z0-9]/.test(s) && /[.)]$/.test(s);

test("every state, for every role, says the five things", () => {
  for (const state of ITEM_STATES)
    for (const role of ROLES)
      for (const demo of [false, true])
        for (const mock of [false, true]) {
          const g = itemGuide(state, role, ctx(demo, mock));
          const where = `${state}/${role}/${demo ? "demo" : "own"}/${mock ? "mock" : "chain"}`;
          assert.equal(g.id, `${state}:${role}`);
          for (const k of ["now", "time", "need", "leave", "money"]) assert.ok(sentence(g[k]), `${where}: ${k} is a sentence: ${g[k]}`);
          assert.ok(g.kicker.length > 2, where);
          assert.match(g.money, /GEN/, `${where}: the money line names an amount`);
          assert.equal(typeof g.mustAct, "boolean");
          if (g.mustAct) assert.match(g.need, /^(Yes|To |Take )/, `${where}: an action is asked for plainly`);
          if (!g.canLeave) assert.match(g.leave, /^Not/, `${where}: why not to leave`);
          if (g.canLeave) assert.match(g.leave, /^You can close the page/, where);
        }
});

test("only the owner with a claim pending is told not to leave, and must act", () => {
  for (const state of ITEM_STATES)
    for (const role of ROLES) {
      const g = itemGuide(state, role, ctx(false, false));
      assert.equal(g.canLeave, !(state === "pending" && role === "owner"), `${state}/${role}`);
    }
  assert.equal(itemGuide("pending", "owner", ctx(false, false)).mustAct, true);
  assert.equal(itemGuide("overdue", "finder", ctx(false, false)).mustAct, true, "the finder is told to default");
  assert.equal(itemGuide("closed", "owner", ctx(false, false)).mustAct, true, "the owner is told to take the reward back");
  assert.equal(itemGuide("no_match", "owner", ctx(true, false)).mustAct, false, "the demo owner reseals by itself");
  assert.equal(itemGuide("no_match", "owner", ctx(false, false)).mustAct, true, "a real owner must reseal");
  assert.equal(itemGuide("pending", "owner", ctx(false, false)).left, 300, "the reveal window counts down");
});

test("the item's status and its latest claim give the state", () => {
  const base = { now: NOW, claimBy: NOW + 100, pending: null, returnedBy: "" };
  assert.equal(stateOf({ ...base, status: "open" }, null), "open");
  assert.equal(stateOf({ ...base, status: "open", claimBy: NOW - 1 }, null), "closed");
  assert.equal(stateOf({ ...base, status: "claimed", pending: { revealBy: NOW + 5 } }, null), "pending");
  assert.equal(stateOf({ ...base, status: "claimed", pending: { revealBy: NOW - 5 } }, null), "overdue");
  assert.equal(stateOf({ ...base, status: "claimed", pending: { revealBy: NOW + 5 } }, null, true), "judging");
  assert.equal(stateOf({ ...base, status: "exposed" }, { finding: "no_match" }), "no_match");
  assert.equal(stateOf({ ...base, status: "exposed" }, { finding: "unclear" }), "unclear");
  assert.equal(stateOf({ ...base, status: "exposed", claimBy: NOW - 1 }, { finding: "unclear" }), "closed");
  assert.equal(stateOf({ ...base, status: "returned" }, { finding: "match" }), "match");
  assert.equal(stateOf({ ...base, status: "returned" }, { finding: "default" }), "default");
  assert.equal(stateOf({ ...base, status: "withdrawn" }, null), "withdrawn");
});

test("every wait the site causes says the five things too", () => {
  const fns = ["deposit", "withdraw", "post_lost", "claim", "reveal", "default", "reseal", "withdraw_reward"];
  for (const fn of fns) {
    for (const g of [signGuide(fn, "100000000000000000"), signGuide(fn), sendingGuide(fn, "100000000000000000", true), sendingGuide(fn)])
      for (const k of ["now", "time", "need", "leave", "money"]) assert.ok(sentence(g[k]), `${g.id}: ${k}: ${g[k]}`);
    assert.equal(signGuide(fn).canLeave, false, "a wallet prompt waits on you");
    assert.equal(sendingGuide(fn).canLeave, true);
  }
  for (const act of ["asking", "reveal", "reseal", "repost", "claim"]) {
    const g = demoGuide(act, "60000000000000000", true);
    for (const k of ["now", "time", "need", "leave", "money"]) assert.ok(sentence(g[k]), `${g.id}: ${k}: ${g[k]}`);
  }
});
