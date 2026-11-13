// The seal as the contract checks it: sha256(hidden_marks + "|" + salt) over UTF-8, 64 lower-case hex.
// The site's own SHA-256 against node's crypto, and the whole seal against contracts/found_it.py's
// _seal(), asked of the contract itself; every salt the site makes passes the contract's _is_salt().

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { newSalt, sealOf, sealedText, sha256Hex } from "../../lib/seal.ts";
import { DEMO_ITEMS, LOST_MARKS_FIRST, demoSalt, setOfSeal } from "../../lib/demo-items.ts";
import { isSalt } from "../../lib/rules.ts";
import { askContract } from "./oracle.mjs";

const node = (t) => createHash("sha256").update(Buffer.from(t, "utf8")).digest("hex");

test("the site's SHA-256 is SHA-256", () => {
  const texts = ["", "abc", "a".repeat(55), "a".repeat(56), "a".repeat(64), "a".repeat(119), "x".repeat(1000), "naïve café ☕ 𝄞", "line\nbreak"];
  for (const t of texts) assert.equal(sha256Hex(t), node(t), JSON.stringify(t.slice(0, 20)));
});

test("the seal is the contract's own _seal(), for every demo set and the suggested marks", () => {
  const pairs = [[LOST_MARKS_FIRST, "abcdefghijklmnop"], ["a red luggage tag reading TIDEPOOL; x", "tidepool7f3a9c21d0e4b8a6"]];
  for (const d of DEMO_ITEMS) for (let seal = 1; seal <= 4; seal++) pairs.push([setOfSeal(d, seal).marks, demoSalt("0x" + "11".repeat(32), d.slug, seal)]);
  const answer = askContract({ seal: pairs, is_salt: pairs.map((p) => p[1]) });
  assert.deepEqual(pairs.map(([m, s]) => sealOf(m, s)), answer.seal);
  assert.ok(answer.is_salt.every(Boolean), "every demo salt is a salt to the contract");
});

test("every salt the browser makes is one the contract takes", () => {
  const made = Array.from({ length: 40 }, () => newSalt());
  assert.ok(made.every((s) => s.length === 32 && isSalt(s)));
  assert.equal(new Set(made).size, made.length, "no two alike");
  assert.ok(askContract({ is_salt: made }).is_salt.every(Boolean));
});

test("the marks are sealed as they will be revealed: trimmed once, here", () => {
  assert.equal(sealedText("  a red tag; a bottle  "), "a red tag; a bottle");
  assert.notEqual(sealOf(" x", "s".repeat(16)), sealOf("x", "s".repeat(16)), "the contract hashes the marks exactly as sent");
});

test("demo salts come from the key, the item and the seal number, and differ for each", () => {
  const k = "0x" + "ab".repeat(32);
  const all = new Set();
  for (const d of DEMO_ITEMS) for (let seal = 1; seal <= 6; seal++) all.add(demoSalt(k, d.slug, seal));
  assert.equal(all.size, 18);
  assert.equal(demoSalt(k, "scarf", 2), demoSalt(k, "scarf", 2));
  assert.notEqual(demoSalt(k, "scarf", 2), demoSalt("0x" + "cd".repeat(32), "scarf", 2));
});
