// Every chip on every field fills it with a value the contract accepts, and the demo texts the bot signs
// pass the contract's doors. The demo chips are read by the in-memory judge the way the demo says they
// should be: the accurate one matches, the vague one is unclear, the wrong one does not match.

import test from "node:test";
import assert from "node:assert/strict";

import { CLAIM_AHEAD_CHIPS, DEPOSIT_CHIPS, MARKS_CHIPS, PUBLIC_CHIPS, REVEAL_CHIPS, REWARD_CHIPS, TITLE_CHIPS } from "../../lib/suggestions.ts";
import { DEMO_ITEMS, FINDER_LINES, LOST_MARKS_FIRST, descriptionChips } from "../../lib/demo-items.ts";
import { judgeByWords } from "../../lib/judge.ts";
import * as r from "../../lib/rules.ts";

test("every chip on /lost is within the contract's limits", () => {
  for (const c of TITLE_CHIPS) assert.equal(r.titleProblem(c.value), "", c.value);
  for (const c of PUBLIC_CHIPS) assert.equal(r.publicProblem(c.value), "", c.value);
  for (const c of MARKS_CHIPS) assert.equal(r.marksProblem(c.value), "", c.value);
  for (const c of REWARD_CHIPS) assert.ok(c.value >= r.MIN_REWARD && c.value <= r.MAX_REWARD, c.label);
  for (const c of REVEAL_CHIPS) assert.ok(c.value >= r.MIN_REVEAL && c.value <= r.MAX_REVEAL, c.label);
  for (const c of CLAIM_AHEAD_CHIPS) assert.ok(c.value >= r.MIN_CLAIM_AHEAD + 300 && c.value <= r.MAX_CLAIM_AHEAD, c.label);
  for (const c of DEPOSIT_CHIPS) assert.ok(c.value >= r.CLAIM_BOND, c.label);
  assert.equal(MARKS_CHIPS[0].value, LOST_MARKS_FIRST, "the first suggested marks are the ones the demo finder knows");
});

test("every demo text the bot signs passes the contract's doors", () => {
  for (const d of DEMO_ITEMS) {
    assert.equal(r.titleProblem(d.title), "");
    assert.equal(r.publicProblem(d.publicDescription), "");
    assert.ok(d.rewardAtto >= r.MIN_REWARD && d.rewardAtto <= r.MAX_REWARD);
    assert.ok(d.revealSeconds >= r.MIN_REVEAL && d.revealSeconds <= r.MAX_REVEAL);
    assert.ok(d.claimAhead >= r.MIN_CLAIM_AHEAD && d.claimAhead <= r.MAX_CLAIM_AHEAD);
    assert.equal(new Set(d.sets.map((s) => s.marks)).size, 3, `${d.slug} has three different mark sets`);
    for (const s of d.sets) {
      assert.equal(r.marksProblem(s.marks), "", s.marks);
      assert.equal(s.marks.split(";").length, 3, "three marks");
      for (const c of descriptionChips(s)) assert.equal(r.descriptionProblem(c.text), "", c.text);
    }
  }
  for (const l of FINDER_LINES) assert.equal(r.descriptionProblem(l.text), "", l.text);
  assert.equal(new Set(DEMO_ITEMS.map((d) => d.title)).size, 3);
});

test("the demo chips read as they promise: accurate matches, vague is unclear, wrong does not match", () => {
  for (const d of DEMO_ITEMS)
    for (const s of d.sets) {
      assert.equal(judgeByWords(s.marks, s.accurate), "match", `${d.slug}: ${s.accurate}`);
      assert.equal(judgeByWords(s.marks, s.vague), "unclear", `${d.slug}: ${s.vague}`);
      assert.equal(judgeByWords(s.marks, s.wrong), "no_match", `${d.slug}: ${s.wrong}`);
      // an accurate line for one set proves nothing about another
      for (const other of d.sets) if (other !== s) assert.notEqual(judgeByWords(other.marks, s.accurate), "match", `${d.slug}: one set's line against another's marks`);
    }
  const [accurate, vague, wrong] = FINDER_LINES;
  assert.equal(judgeByWords(LOST_MARKS_FIRST, accurate.text), "match");
  assert.equal(judgeByWords(LOST_MARKS_FIRST, vague.text), "no_match");
  assert.equal(judgeByWords(LOST_MARKS_FIRST, wrong.text), "no_match");
});
