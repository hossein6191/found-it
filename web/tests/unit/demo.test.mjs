// The demo bot's plumbing, with no network: the forgiving key reader and its exact complaints, the rate
// limiter, the fixed rotation of mark sets, and the routes that sign: each takes an item id (and the
// claim route one of three line keys), never a text from the visitor, and nothing logs or returns the key.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { BAD_KEY, NO_KEY, cleanKey, keyProblem } from "../../lib/demo-key.ts";
import { createLimiter } from "../../lib/demo-limit.ts";
import { DEMO_ITEMS, demoOfTitle, isFinderLine, setOfSeal } from "../../lib/demo-items.ts";

const K = "ab".repeat(32);

test("the key reader forgives the ways a key gets pasted, and names what is wrong without repeating it", () => {
  for (const pasted of [K, "0x" + K, "0X" + K, `"0x${K}"`, `'${K}'`, `  0x${K}\n`, "`" + K + "`"]) {
    assert.equal(keyProblem(pasted), "", JSON.stringify(pasted.slice(0, 6)));
    assert.equal(cleanKey(pasted), "0x" + K);
  }
  assert.equal(keyProblem(undefined), NO_KEY);
  assert.equal(keyProblem("   "), NO_KEY);
  assert.equal(keyProblem('""'), NO_KEY);
  assert.equal(keyProblem("0x1234"), BAD_KEY);
  assert.equal(keyProblem(K + "zz"), BAD_KEY);
  assert.ok(!BAD_KEY.includes(K));
});

test("the limiter: one attempt per item every twenty seconds, twelve a minute in all", () => {
  const l = createLimiter({ perKeyMs: 20_000, globalMax: 12, globalWindowMs: 60_000 });
  assert.deepEqual(l.attempt("L1", 0), { ok: true });
  assert.equal(l.attempt("L1", 1000).ok, false);
  assert.equal(l.attempt("L1", 20_000).ok, true);
  for (let i = 2; i <= 11; i++) assert.equal(l.attempt("L" + i, 21_000).ok, true);
  assert.equal(l.attempt("L99", 22_000).ok, false, "the thirteenth in a minute waits");
  l.hold("L5", 100_000, 30_000);
  assert.equal(l.attempt("L5", 90_000).ok, false);
});

test("each demo item goes round its three mark sets, one per seal", () => {
  for (const d of DEMO_ITEMS) {
    assert.equal(setOfSeal(d, 1), d.sets[0]);
    assert.equal(setOfSeal(d, 2), d.sets[1]);
    assert.equal(setOfSeal(d, 3), d.sets[2]);
    assert.equal(setOfSeal(d, 4), d.sets[0]);
    assert.equal(demoOfTitle(d.title), d);
  }
  assert.equal(demoOfTitle("Navy backpack, number 12 bus "), null, "a title is a demo title only word for word");
  assert.ok(isFinderLine("accurate") && isFinderLine("vague") && isFinderLine("wrong") && !isFinderLine("anything"));
});

test("the demo routes sign nothing a visitor wrote, and nothing logs or returns the key", () => {
  const dir = new URL("../../app/api/demo/", import.meta.url);
  const routes = readdirSync(dir).filter((n) => !n.startsWith("."));
  assert.deepEqual(routes.sort(), ["claim", "repost", "reseal", "reveal", "status"]);
  for (const r of routes) {
    const src = readFileSync(new URL(`${r}/route.ts`, dir), "utf8");
    assert.ok(!/console\./.test(src), `${r} logs nothing`);
    assert.ok(!/DEMO_OWNER_KEY/.test(src), `${r} never touches the key itself`);
    if (r !== "status") assert.match(src, /parseItemId\(body\.item\)/, `${r} reads only an item id`);
  }
  const server = readFileSync(new URL("../../lib/demo-server.ts", import.meta.url), "utf8");
  assert.ok(!/console\./.test(server), "the bot logs nothing");
  assert.equal((server.match(/process\.env\.DEMO_OWNER_KEY/g) ?? []).length, 2, "the key is read in two places only");
  assert.ok(!/body:\s*\{[^}]*key/i.test(server), "no answer carries the key");
  assert.match(server, /finderLine\(line\)/, "the finder claims with one of its fixed lines");
});
