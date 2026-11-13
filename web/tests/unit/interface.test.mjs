// The site against the contract it talks to, read from contracts/found_it.py in this repository: every
// write builder names a real write method with the right number of arguments and sends value only to the
// payable ones; every view exists and the site reads every view; the limits, the four questions, the
// scope paragraph and the reasons are the contract's own; the readers of the caller's arguments answer as
// the contract's do (asked of the contract itself through python3); every refusal sentence the in-memory
// contract gives is made of the contract's words; and the in-memory rules() is the contract's rules(),
// compared whole.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { calls } from "../../lib/calls.ts";
import * as rules from "../../lib/rules.ts";
import { CONTRACT_RULES } from "../../lib/contract-rules.ts";
import { askContract } from "./oracle.mjs";

const raw = readFileSync(new URL("../../../contracts/found_it.py", import.meta.url), "utf8");
// The contract's source with escaped quotes read as quotes and adjacent string literals joined, so its
// sentences can be looked up whole.
const contract = raw
  .replace(/\\"/g, '"')
  .replace(/"\s*\n\s*"/g, "")
  .replace(/"\s*\n\s*\+\s*"/g, "")
  .replace(/"\s*\+\s*\n\s*"/g, "")
  .replace(/" "/g, "")
  .replace(/"\s*\+\s*str\([^)]*\)\s*\+\s*"/g, "@")
  .replace(/"\s*\+\s*\w+\s*\+\s*"/g, "@");
const chainSource = readFileSync(new URL("../../lib/chain.ts", import.meta.url), "utf8");
const mockSource = readFileSync(new URL("../../lib/chain-mock.ts", import.meta.url), "utf8");

function methods() {
  const out = {};
  const re = /@gl\.public\.(write(?:\.payable)?|view)\s*\n\s*def (\w+)\(self(?:,\s*([^)]*))?\)/g;
  for (const m of raw.matchAll(re)) {
    const params = (m[3] ?? "").split(",").map((p) => p.trim()).filter(Boolean);
    out[m[2]] = { kind: m[1].startsWith("view") ? "view" : "write", payable: m[1].endsWith("payable"), params: params.length };
  }
  return out;
}

const constant = (name) => {
  const m = new RegExp(`^${name}\\s*=\\s*([^#\\n]+)`, "m").exec(raw);
  assert.ok(m, `the contract defines ${name}`);
  return m[1].trim();
};

/** A Python string constant, parenthesised over several lines or on one, its literals joined. */
const pyString = (name) => {
  const at = raw.indexOf(`\n${name} = `);
  assert.ok(at >= 0, `the contract defines ${name}`);
  let i = at + name.length + 4;
  let depth = 0;
  let quote = "";
  const parts = [];
  let cur = "";
  for (; i < raw.length; i++) {
    const ch = raw[i];
    if (quote) {
      if (ch === "\\") {
        cur += raw[i + 1] === '"' || raw[i + 1] === "'" ? raw[i + 1] : ch + raw[i + 1];
        i++;
      } else if (ch === quote) {
        parts.push(cur);
        cur = "";
        quote = "";
        if (depth === 0) break;
      } else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth <= 0) break;
    } else if (ch === "\n" && depth === 0) break;
  }
  return parts.join("");
};

test("every write builder names a write method of the contract, with its arguments and its value", () => {
  const all = methods();
  const built = [
    calls.deposit(10n ** 16n),
    calls.withdraw(1n),
    calls.postLost("Navy backpack", "x".repeat(30), "a".repeat(64), 600, 1, 10n ** 17n),
    calls.claim("L1", "x".repeat(30)),
    calls.reveal("L1", "x".repeat(30), "a".repeat(16)),
    calls.default("L1"),
    calls.reseal("L1", "b".repeat(64)),
    calls.withdrawReward("L1"),
  ];
  const writes = Object.entries(all).filter(([, m]) => m.kind === "write").map(([n]) => n).sort();
  assert.equal(writes.length, 8);
  assert.deepEqual([...new Set(built.map((c) => c.fn))].sort(), writes, "the site can send every write and nothing else");
  for (const c of built) {
    const m = all[c.fn];
    assert.equal(c.args.length, m.params, `${c.fn} takes ${m.params} arguments`);
    assert.equal(c.value !== undefined, m.payable, `${c.fn} sends value only when payable`);
  }
  assert.deepEqual(calls.postLost("t", "p", "d", 600, 99, 5n).args, ["t", "p", "d", 600, 99], "post_lost's arguments in the contract's order");
  assert.deepEqual(calls.reveal("L2", "m", "s").args, ["L2", "m", "s"], "reveal(item, hidden_marks, salt)");
  assert.equal(calls.withdraw(123n).args[0], "123", "withdraw takes the amount as digits");
});

test("every view of the contract is read by the site, with its arguments, and the mock answers each", () => {
  const views = Object.entries(methods()).filter(([, m]) => m.kind === "view");
  assert.equal(views.length, 7);
  for (const [name, m] of views) {
    assert.match(chainSource, new RegExp(`view\\("${name}"`), `lib/chain.ts reads ${name}()`);
    assert.match(mockSource, new RegExp(`case "${name}"`), `the mock answers ${name}()`);
    assert.ok(m.params <= 3);
  }
});

test("the limits are the contract's own", () => {
  const GEN = 10n ** 18n;
  assert.equal(constant("MIN_REWARD, MAX_REWARD"), "GEN // 20, 50 * GEN");
  assert.equal(rules.MIN_REWARD, GEN / 20n);
  assert.equal(rules.MAX_REWARD, 50n * GEN);
  assert.equal(constant("CLAIM_BOND"), "GEN // 50");
  assert.equal(rules.CLAIM_BOND, GEN / 50n);
  const pairs = { "MIN_TITLE, MAX_TITLE": [rules.MIN_TITLE, rules.MAX_TITLE], "MIN_PUBLIC, MAX_PUBLIC": [rules.MIN_PUBLIC, rules.MAX_PUBLIC], "MIN_DESCRIPTION, MAX_DESCRIPTION": [rules.MIN_DESCRIPTION, rules.MAX_DESCRIPTION], "MIN_MARKS, MAX_MARKS": [rules.MIN_MARKS, rules.MAX_MARKS], "MIN_SALT, MAX_SALT": [rules.MIN_SALT, rules.MAX_SALT] };
  for (const [k, v] of Object.entries(pairs)) assert.equal(constant(k), v.join(", "), k);
  assert.equal(constant("MIN_REVEAL, MAX_REVEAL"), "600, 7 * 86400");
  assert.deepEqual([rules.MIN_REVEAL, rules.MAX_REVEAL], [600, 7 * 86400]);
  assert.equal(Number(constant("CLAIMS_PER_FINDER")), rules.CLAIMS_PER_FINDER);
  assert.equal(Number(constant("MIN_CLAIM_AHEAD")), rules.MIN_CLAIM_AHEAD);
  assert.equal(constant("MAX_CLAIM_AHEAD"), "365 * 86400");
  assert.equal(Number(constant("PAGE_CAP")), rules.PAGE);
  assert.equal(Number(constant("DIGEST_CHARS")), rules.DIGEST_CHARS);
  for (const s of rules.STATUSES) assert.match(raw, new RegExp(`= "${s}"`), `the contract has the status ${s}`);
});

test("the four questions, the scope paragraph and the reasons are the contract's, word for word", () => {
  assert.equal(rules.QUESTION_NAMES_TWO, pyString("QUESTION_NAMES_TWO"));
  assert.equal(rules.QUESTION_NOTHING_WRONG, pyString("QUESTION_NOTHING_WRONG"));
  assert.equal(rules.QUESTION_FEWER, pyString("QUESTION_FEWER"));
  assert.equal(rules.QUESTION_SOMETHING_WRONG, pyString("QUESTION_SOMETHING_WRONG"));
  assert.equal(rules.SCOPE, pyString("SCOPE"));
  const answer = askContract({ rules: true, why: true });
  assert.deepEqual({ ...rules.WHY }, { match: answer.why.match, no_match: answer.why.no_match, unclear: answer.why.unclear, default: answer.why.default });
  assert.deepEqual(CONTRACT_RULES, answer.rules, "the in-memory rules() is the contract's rules(), whole");
});

test("the readers of the caller's arguments answer as the contract's do", () => {
  const texts = ["", "ab", "abc", "  abc  ", "a\tb c d", "é".repeat(5) + "abcdefgh", "x".repeat(80), "x".repeat(81), "  " + "x".repeat(79) + "  ", "naïve but long enough text", 5];
  const asks = texts.map((t) => [t, 3, 80, "the title"]);
  const digests = ["a".repeat(64), "A".repeat(64), "  " + "b".repeat(64) + " ", "g".repeat(64), "a".repeat(63), "a".repeat(81), 7];
  const salts = ["abcdefghijklmnop", "abcdefghijklmno", "a".repeat(64), "a".repeat(65), "abc-defghijklmnop", "ÄBCDEFGHIJKLMNOP"];
  const wholes = [0, 5, -1, "12", " 7 ", "1.5", "", "٣", true, "0099"];
  const ids = [["L1", "L"], ["L0", "L"], ["L01", "L"], ["L123456789", "L"], ["L1234567890", "L"], ["C4", "L"], ["L", "L"], ["L1a", "L"]];
  const answer = askContract({ text_problem: asks, digest_of: digests, is_salt: salts, whole: wholes, is_id: ids });
  assert.deepEqual(asks.map(([r, a, b, w]) => rules.textProblem(r, a, b, w)), answer.text_problem);
  assert.deepEqual(digests.map((d) => rules.digestOf(d)), answer.digest_of);
  assert.deepEqual(salts.map((s) => rules.isSalt(s)), answer.is_salt);
  assert.deepEqual(wholes.map((w) => rules.whole(w)), answer.whole);
  assert.deepEqual(ids.map(([t, p]) => rules.isId(t, p)), answer.is_id);
});

test("every refusal the in-memory contract gives is made of the contract's own words", () => {
  const body = mockSource.slice(mockSource.indexOf("// ---- the writes"), mockSource.indexOf("// ---- the views"));
  const literals = [...body.matchAll(/fail\(([^;]+)\);|problem = ([^;]+);|refuse\(c\.sender, c?\.?value, ([^)]+)\)/g)]
    .flatMap((m) => [...(m[1] ?? m[2] ?? m[3]).matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)].map((x) => x[1] ?? x[2]))
    .filter((s) => s.trim().length >= 12);
  assert.ok(literals.length >= 25, `found ${literals.length} pieces of refusal sentences`);
  for (const piece of literals) assert.ok(contract.includes(piece), `the contract says "${piece}"`);
});
