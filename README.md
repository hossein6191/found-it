# Found It

A lost-property reward that pays only the real finder. The owner seals the
item's hidden marks, a finder describes them, and validators decide whether the
description matches before the reward moves.

## The problem

Somebody loses a backpack on a bus and offers a reward for it. The reward
brings out the finder, and it also brings out everybody else: anyone can say
"I have it" and ask for the money first. The usual check is a question only the
owner can answer, such as "what is on the luggage tag?", and the owner then
decides whether the answer is right. That puts the whole judgement in the hands
of the person who keeps the reward if they say no. A string match does no
better: the finder who writes "a red tag that says TIDEPOOL" has named the
"red luggage tag reading TIDEPOOL" exactly, in different words.

## What it is

The owner posts the item with its reward, 0.05 to 50 GEN, held here in escrow.
The post says what anyone may know ("A navy blue backpack lost on the number 12
bus on 3 March") and seals what only the owner knows: a few hidden marks, such
as "a red luggage tag reading TIDEPOOL; a cracked green water bottle in the
side pocket", committed as `sha256(hidden_marks + "|" + salt)` and checked in
code. Nobody claiming the item can see them.

Anyone but the owner may claim it before its claim deadline, one claim at a
time, staking a claim bond of 0.02 GEN from credit deposited beforehand and
writing their own account of the hidden marks. No model runs in a claim. The
claim opens the owner's reveal window. The owner reveals the marks and the
salt, the code checks them against the seal, and in the same call one consensus
round reads the marks and that one description and decides:

| finding | what it means | the money, in the same call |
|---|---|---|
| `match` | the description names at least two of the marks and contradicts none | the reward to the finder, the bond back to the finder's credit; the item is returned |
| `no_match` | it names fewer than two, or it contradicts one | the bond to the owner |
| `unclear` | the four readings did not settle it either way | the bond back to the finder's credit |

The handover of the item happens off chain; the reward pays for the proof.

Hiding the marks never saves the owner money: a claim the owner does not
answer within the reveal window may be defaulted by anyone, and is paid the
reward as if it matched. A judged claim makes the marks public, so the item
takes no further claim against them: after a `no_match` or an `unclear` the
item is `exposed` until its owner seals new marks with `reseal()`, and only
then takes claims again. Each seal is judged against at most one claim, and an
item never seals the same digest twice. If the claim deadline passes with no
successful claim and nothing pending, the owner takes the reward back with
`withdraw_reward()`.

## How consensus is used

`reveal(item, hidden_marks, salt)` runs one
`gl.vm.run_nondet_unsafe(leader_fn, validator_fn)` block. Inside its leader
closure the model is asked two framings, each in two orders, four askings in
all. Each framing asks two plain questions, one condition each. Word for word
from the contract:

> **MATCHES.** Question 1: Does the FINDER'S DESCRIPTION correctly name at least
> two of the HIDDEN MARKS? Answer yes, no or unclear.
> Question 2: Is the FINDER'S DESCRIPTION free of any statement that
> contradicts the HIDDEN MARKS? Answer yes, no or unclear.

> **GUESS.** Question 1: Does the FINDER'S DESCRIPTION correctly name fewer than
> two of the HIDDEN MARKS? Answer yes, no or unclear.
> Question 2: Does the FINDER'S DESCRIPTION contain a statement that contradicts
> the HIDDEN MARKS? Answer yes, no or unclear.

GUESS is MATCHES negated, asked in an asking of its own. What a named mark and
a contradiction are is said once, before the blocks, in the same words every
time:

> A hidden mark is correctly named only when the FINDER'S DESCRIPTION states
> that mark specifically: the same thing, with the colour, words, name, damage
> or place the HIDDEN MARKS give it, in any words. A description that says only
> something general, such as "a bag", "some stuff inside", "a tag" or "a
> bottle", names no mark. A statement contradicts the HIDDEN MARKS when both
> cannot be true of the same item, such as other words on the same tag or
> another name on the same card. A detail the HIDDEN MARKS do not mention
> neither names a mark nor contradicts one.

| asking | the block shown first | questions |
|---|---|---|
| `matches/marks_first` | HIDDEN_MARKS | MATCHES |
| `matches/description_first` | FINDER_DESCRIPTION | MATCHES |
| `guess/marks_first` | HIDDEN_MARKS | GUESS |
| `guess/description_first` | FINDER_DESCRIPTION | GUESS |

A reply counts only as `{"names_two": "yes", "nothing_wrong": "no"}` (or
`fewer_than_two` and `something_wrong` for GUESS), each value the JSON string
`yes`, `no` or `unclear` in any case. A boolean, a number, "true", "Yes,
mostly" or a missing key makes that asking unreadable.

Each of the two conditions is read four ways and combined in code:

| condition | holds when | fails when |
|---|---|---|
| names two marks | `names_two` yes in both orders and `fewer_than_two` no in both | `names_two` no in both and `fewer_than_two` yes in both |
| contradicts none | `nothing_wrong` yes in both orders and `something_wrong` no in both | `nothing_wrong` no in both and `something_wrong` yes in both |

`match` only when both hold; `no_match` when either fails; `unclear` otherwise,
an unreadable asking included. So a reader led by which block comes first, a
reader that says yes to everything and a reader that says no to everything all
land on `unclear`, which moves no money to anybody.

**Agreement.** The stored value is `{"finding": "match" | "no_match" |
"unclear"}`. Every validator reruns all four askings itself and compares the
finding by exact string equality. A validator whose own rerun raises
disagrees, and a leader that raised is never agreed with, so an unreachable
model is never stored as an answer. Every model call is written inside the
leader closure; nothing is nested.

**The prompt boundary.** The marks and the description reach the model fenced
(`<` and `>` replaced, never deleted) between delimiter lines tagged with the
sha256 of the block's own fenced text, after a paragraph that declares both
blocks untrusted. The door admits only printable ASCII on one line. The model
never sees an amount, an address, the title, the public description or an id.
The largest possible prompt is 3,316 characters.

## Why GenLayer

Whether "a red tag that says TIDEPOOL and a green bottle with a crack in the
side pocket" names "a red luggage tag reading TIDEPOOL; a cracked green water
bottle in the side pocket", whether "a library card for Ines Corrie"
contradicts "a library card for Mara Quist", and whether "a blue bag with some
stuff inside" names anything at all, are judgements about meaning. No string
match tells the first from a paraphrase that misses, and a single model call is
one reading that whoever runs it controls, here the owner, who keeps the reward
and every forfeited bond if the answer is no. On GenLayer every validator reads
the claim for itself, in both framings and both orders, and only a finding
they agree on exactly moves money. The owner cannot even decline to ask: a
claim left unanswered is paid.

## Who may do what

| call | who | refused how |
|---|---|---|
| `deposit()` | anyone, for their own credit | a call that sends nothing returns `ok: false` |
| `withdraw(amount_atto)` | anyone, from their own credit, any time | raises `[EXPECTED] ...`; nothing was sent |
| `post_lost(title, public_description, marks_digest, reveal_seconds, claim_by)` | anyone; the sender is the owner, the value is the reward | returns `ok: false` with everything sent |
| `claim(item, description)` | anyone but the owner, while the item is open and before `claim_by`; one claim pending at a time; at most two claims per address per item | raises `[EXPECTED] ...`; the bond stays in credit |
| `reveal(item, hidden_marks, salt)` | only the owner, within the pending claim's reveal window | raises `[EXPECTED] ...` before any model is asked, including when the marks and the salt do not open the seal |
| `default(item)` | anyone, once the pending claim's reveal window has passed | raises `[EXPECTED] ...` |
| `reseal(item, marks_digest)` | only the owner, while the item is exposed and before `claim_by`; never a digest the item sealed before | raises `[EXPECTED] ...` |
| `withdraw_reward(item)` | only the owner, from `claim_by`, with no successful claim and none pending | raises `[EXPECTED] ...` |

`post_lost`, `deposit` and `default` are open on purpose: the first two bind
only the sender's own money, and `default` pays only the claim's finder, never
the caller. A static test fails on any write that neither refuses by sender nor
is listed with its reason. No call that carries value asks a model.

## The money

| moment | from | to | amount |
|---|---|---|---|
| `deposit` | anyone | the contract, credited to them | what they send |
| `post_lost` | the owner | the item's escrow | the reward, 0.05 to 50 GEN |
| `claim` | the finder's credit | the claim's bond | 0.02 GEN |
| `reveal`, match | the escrow | the finder | the reward; the bond back to the finder's credit |
| `reveal`, no_match | the bond | the owner | 0.02 GEN |
| `reveal`, unclear | the bond | the finder's credit | 0.02 GEN |
| `default` | the escrow | the finder | the reward; the bond back to the finder's credit |
| `withdraw_reward` | the escrow | the owner | the reward |
| `withdraw` | the contract | the depositor | any part of their credit |
| a refused `deposit` or `post_lost` | the contract | the sender | everything sent |

The contract holds only credit, rewards in escrow and bonds at stake, and
`stats()` publishes their sum as `balance_owed`. The offline suite checks it
against the contract's books after every step of eighty seeded random
journeys, then drains every journey to zero. Every settlement makes at most one
transfer, after everything else is written, and no call walks a list.

## The limits, stated plainly

- **The contract cannot see the item.** It judges whether the finder knows what
  only somebody holding the real item would know, and pays for that proof. The
  handover happens off chain.
- **An owner who writes vague marks gets vague answers.** A mark a guess could
  name ("some papers inside") proves nothing, and a mark nobody could find
  without the owner's memory can defeat an honest finder, who then loses the
  bond to the owner. `claims_of(item)` shows every earlier claim, its finding
  and the marks it was judged against.
- **Once revealed, the marks are public.** That is why a judged claim leaves the
  item exposed until new marks are sealed, and why each seal is judged once.
  The contract refuses a digest the item sealed before, but cannot see the
  marks inside a new one: an owner who seals revealed marks again under a new
  salt has given them away.
- **Every judged claim costs the owner a set of marks.** A stranger willing to
  lose 0.02 GEN per try can make the owner reveal one seal after another. Each
  try pays the owner the bond, and an owner with few marks left can stop
  resealing and take the reward back at `claim_by`.
- **Hiding the marks never saves the owner money.** A claim the owner does not
  answer within the reveal window is paid as if it matched, whatever it says.
  An owner who posts must watch for claims.
- **A reveal the network does not carry stores nothing.** The claim stays
  pending and the owner sends the reveal again within the window; a window that
  runs out pays the claim. An owner should reveal early in the window.
- **The owner can take the reward back early through a second address** that
  claims and is never answered. The reward binds the owner's own marks, not the
  owner's goodwill.
- **A description is public as soon as it is sent.** Claims are taken one at a
  time in the order the network applies them; a description that read unclear
  is no help to a copier, because the next claim meets new marks.
- **English, in printable ASCII, on one line.** Titles are 3 to 80 characters,
  public descriptions 20 to 300, descriptions and hidden marks 20 to 500. The
  door refuses anything else.
- **No readable clock, nothing recorded.** The clock is the message clock,
  `gl.message_raw["datetime"]`.

## What is in this repository

```
contracts/found_it.py       the contract
tests/test_pure.py          the offline suite: the doors, the round with a scripted model per node, the money
tests/MUTATIONS.md          every defence removed in turn, and the test that caught it
tests/on_chain/smoke.mjs    a throwaway-account run against Studio
tools/mutate.py             the generator that writes MUTATIONS.md and refuses to if anything survives
web/                        the site (see The site, below)
CONTRACTS.md                purpose, consensus, state, methods, bounds, reuse and limits
DECISIONS.md                why each rule is the way it is, and what is verified and what is not
```

## Running it

```
pip install -r requirements-dev.txt
pytest tests/ -q                                 # no network, no Studio
genvm-lint check contracts/found_it.py           # the package is genvm-linter, the command genvm-lint
python tools/mutate.py                           # rewrites tests/MUTATIONS.md; exits 1 if a mutant survives
```

- `pytest tests/ -q` gives **229 passed** in a few seconds, with nothing
  installed but pytest.
- `genvm-lint check` version 0.11.0 prints `Lint passed (3 checks)` and
  `Validation passed`, reads Found It as 15 methods (7 view, 8 write), and
  exits 0.
- `python tools/mutate.py` removes or inverts **220 defences** one at a time,
  and **none survives**; `tests/MUTATIONS.md` names the test that failed for
  each.

The on-chain run generates its own keys and funds them over the network's own
RPC; it never touches a wallet of anybody's own:

```
npm ci
node tests/on_chain/smoke.mjs                    # the whole run, about 35 to 55 minutes
RESUME=1 node tests/on_chain/smoke.mjs           # continue a run that was cut off
STATE=run.json RESUME=1 node tests/on_chain/smoke.mjs
```

It plays four generated accounts. The owner posts the navy backpack (0.5 GEN),
a black umbrella (0.2 GEN, a ten-minute reveal window) and a grey wool scarf
(0.1 GEN, claims closing twenty minutes later), after a post of 0.01 GEN is
refused with every atto returned. The guesser claims the backpack with "A red
tag reading HARBOUR and a library card for Ines Corrie": a stranger is refused
a second claim and a reveal, and the owner's reveal of seal A ("a library card
for Mara Quist in the front pocket; a spare door key on a blue lanyard") reads
`no_match`, the bond to the owner. The stranger copies seal A into a claim and
is refused; the owner reseals with seal B, and the guesser's "It is a blue bag
with some stuff inside" reads `no_match`, too general. The owner reseals with
seal C ("a red luggage tag reading TIDEPOOL; a cracked green water bottle in
the side pocket; a folded bus map of Lowbridge in the inner pocket"); the
guesser's third claim is refused; the finder's "It has a red tag that says
TIDEPOOL and a green bottle with a crack in the side pocket" reads `match` and
the 0.5 GEN reaches the finder in the same transaction. The owner never answers
the finder's claim on the umbrella, and the stranger defaults it: 0.2 GEN to the
finder. Nobody claims the scarf, and the owner takes its 0.1 GEN back. It
prints one PASS or FAIL line per check, ends with `N passed, M failed`, reads
every account's balance against the receipts, and compares the deployed code
with `contracts/found_it.py` byte for byte. Every step is saved to the state
file as it is made, so a run that outlives its process continues where it
stopped without sending anything twice.

## The site

`web/` is the site, a Next.js 16 app (Vercel Root Directory `web`). It talks to the contract on Studio,
chain 61999, through the visitor's own wallet, and reads every view with a paced retry so Studio's 30
reads a minute are never spent twice.

| page | what it is for |
|---|---|
| `/` | the promise in one minute, how the money moves, where to start |
| `/found` | the demo shelf: pick one of three lost items, see what its finder sees, describe it with a chip or in your own words, claim, and watch the demo owner reveal and the validators judge; the printed slip says where the money went |
| `/item/[id]` | any item: what anyone may know, the sealed marks as a folded note, every claim with its finding; reveal, reseal and take the reward back for its owner; default for anyone once a reveal window passed |
| `/lost` | post a lost item: the page makes the salt, computes `sha256(hidden_marks + "\|" + salt)` exactly as the contract checks it, and keeps the marks and the salt in the browser with a warning to copy them |
| `/mine` | the items you lost and claimed, your credit for claim bonds, the seals this browser keeps |
| `/ledger` | every item, and the contract's own books |
| `/how` | the four questions word for word, why GenLayer, the money table, the limits, `rules()` read live |

**One wallet plays both sides.** A demo bot holds a throwaway Studio key in `DEMO_OWNER_KEY` (server
only, never logged, read forgivingly with or without `0x` and quotes). As the demo owner it keeps three
items posted: a navy backpack on the number 12 bus, a black umbrella at Harbour Library and a green
scarf at the Tidepool Cafe, each with a short reward and a fixed rotation of three mark sets, the salt
of each seal made from the key, so the bot keeps no state. After a visitor's claim on one of them is
final, the page asks `POST /api/demo/reveal {item}`; a judged item is resealed with the next set by
`POST /api/demo/reseal {item}`, and a returned one goes back on the shelf with `POST /api/demo/repost
{item}`. As the demo finder it claims a visitor's own item with one of three fixed lines, `POST
/api/demo/claim {item, line}`. Nothing a visitor types is ever signed by the bot. `GET /api/demo/status`
says whether it is online, its items, and exactly why not when it is not.

```
cd web
npm ci
REGISTER=0x... DEMO_OWNER_KEY=0x... node tools/open-demo.mjs    # funds the bot, deposits its credit, posts the three items
DRY=1 REGISTER=0x... node tools/open-demo.mjs                   # check and print, send nothing
npm run dev:mock                                                # the whole site on an in-memory copy of the contract
```

`NEXT_PUBLIC_CONTRACT` names the deployed contract (or `DEMO_CONTRACT` in `web/lib/config.ts`);
`web/.env.example` lists every setting. With `NEXT_PUBLIC_MOCK=1` the site runs on `web/lib/chain-mock.ts`,
which follows the contract on every deterministic rule, refusal sentence and atto, and judges a reveal by
counting each mark's words where the validators would ask their models; a bar on every page says so.

`npm run test:site` runs the site's own checks with node and no network: every call against the
contract's signatures, the digest and the door readers against the contract itself (through `python3`
and a stub of the runtime), `rules()` compared whole, the mock through every outcome (match, no match,
unclear, default, reseal, repost, the reward taken back) with no atto created or lost at any step, the
waiting copy for every state and role, every chip within the contract's limits, and a hygiene scan.

## Network

Studio, chain 61999. RPC `https://studio.genlayer.com/api`, explorer
`https://explorer-studio.genlayer.com`. The contract pins the runner
`py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` in its first
line.

## Evidence

Run on 13 November 2026 on GenLayer Studio (chain 61999) by `tests/on_chain/smoke.mjs`, from generated accounts funded from the
Studio faucet, none of them anybody's wallet: **OWNER** posts and seals, **FINDER** and **GUESSER** claim, **STRANGER** tries what it may not. **42 passed, 0 failed**; transactions: 26 in 26 steps; sent a second time: none.
The whole log is `tests/on_chain/smoke-run.log`. Each seal was judged against one claim: a description that got a mark wrong read no match and its bond went to the owner; one too general to identify the bag read no match; after a reseal, the finder's description of the TIDEPOOL tag and the cracked green bottle read match and the reward reached the finder in that transaction. An owner who never revealed was defaulted, and the claim was paid.

- `deploy` deployed at [`0x428CC86a2ea976769e218Fc2915E2E54294cA1Be`](https://explorer-studio.genlayer.com/address/0x428CC86a2ea976769e218Fc2915E2E54294cA1Be)

- the code deployed at 0x428CC86a2ea976769e218Fc2915E2E54294cA1Be is byte for byte contracts/found_it.py: 61649 bytes, sha256 5ad6a6a1de82cf54c3cebf141b8c731549c2352a086e8fe4132e9b3603137a47

| step | by | transactions | votes |
|---|---|---|---|
| Found It is deployed and holds nothing yet | OWNER | [0xe4816219…](https://explorer-studio.genlayer.com/tx/0xe481621939bb643c7f02d4b8804acbd02f3fbc6c9999ae91a2870b544344eb5d) | 3 agree, 0 disagree, 2 idle |
| FINDER deposits 0.04 GEN of credit, two claim bonds; no model runs | FINDER | [0xf4698fc2…](https://explorer-studio.genlayer.com/tx/0xf4698fc28a8c1cc828fbf6af326cf9aa334fdc6bd6152030558326ee5f27c428) | 3 agree, 0 disagree, 2 idle |
| GUESSER deposits 0.04 GEN of credit, two claim bonds; no model runs | GUESSER | [0xf5683d4e…](https://explorer-studio.genlayer.com/tx/0xf5683d4e65dee1500d53c9392e15d015ab2fd2b51aab202880ef71f8a866353e) | 3 agree, 0 disagree, 2 idle |
| OWNER posts with 0.01 GEN, under the 0.05 GEN floor: refused, and every atto comes back in the same transaction | OWNER | [0xd26cea45…](https://explorer-studio.genlayer.com/tx/0xd26cea4569fa7220b0b02b61bd317e3a98ef5b7e80d7ecad2d3246570ac27f51) | 3 agree, 0 disagree, 2 idle |
| OWNER posts L1, the navy backpack, with a 0.5 GEN reward and seal A; no model runs | OWNER | [0x659f8748…](https://explorer-studio.genlayer.com/tx/0x659f8748dfb7a33f75a5e9e50bf1a73287edebd9ac53d5c39249314d9c2cd7f4) | 4 agree, 0 disagree, 1 idle |
| OWNER posts L2, the black umbrella, 0.2 GEN, with a ten-minute reveal window | OWNER | [0x645519ed…](https://explorer-studio.genlayer.com/tx/0x645519ed21a0f52c4bc8e1d10541d070f2e7443840c6a882c48f1324a6695bac) | 3 agree, 0 disagree, 2 idle |
| OWNER posts L3, the grey wool scarf, 0.1 GEN, claims closing twenty minutes on | OWNER | [0x21898797…](https://explorer-studio.genlayer.com/tx/0x21898797ec883a0ed16a26d5f01870911b20f6c912683fe16a904b42d7e461d7) | 3 agree, 0 disagree, 2 idle |
| OWNER tries to take L3's reward back at once: refused, its claims are still open | OWNER | [0xe81f82b3…](https://explorer-studio.genlayer.com/tx/0xe81f82b32f0784267ef57627f7aa6461f1fe4fc541e5185b9d9e1ad8506fe6c1) | 3 agree, 0 disagree, 2 idle |
| FINDER claims L2: the bond leaves credit, no model runs, the reveal window opens | FINDER | [0xe958b9e4…](https://explorer-studio.genlayer.com/tx/0xe958b9e4477b7deffbeaa59c2bcc9ae4388f5d380395dad365ec8cf59583ad7b) | 3 agree, 0 disagree, 2 idle |
| STRANGER tries to default L2 at once: refused, the reveal window is open | STRANGER | [0x2ba9f1de…](https://explorer-studio.genlayer.com/tx/0x2ba9f1dede8da6728c9ad853409823c1590f3a981074601b96d11a6680fd8b97) | 3 agree, 0 disagree, 2 idle |
| GUESSER claims L1: a red tag reading HARBOUR, a library card for Ines Corrie | GUESSER | [0xcd77cc31…](https://explorer-studio.genlayer.com/tx/0xcd77cc31b9b7b3f59808c5a652a17def33f7b98c2d60aa3628dd6eb652cf0f17) | 3 agree, 0 disagree, 2 idle |
| STRANGER claims L1 too: refused, one claim at a time | STRANGER | [0xcd5db961…](https://explorer-studio.genlayer.com/tx/0xcd5db961d8095ad500391f66b98c99df732764f25f06689941905cb875011b89) | 3 agree, 0 disagree, 2 idle |
| STRANGER tries to reveal L1 with the right marks and salt: refused, only the owner may | STRANGER | [0x679fded8…](https://explorer-studio.genlayer.com/tx/0x679fded886db3684436ec5dac24aae8abba72327f11e71251e564d1a6774effd) | 3 agree, 0 disagree, 2 idle |
| OWNER reveals seal A; one consensus round of four askings reads the card as contradicted: no_match | OWNER | [0xc8768a22…](https://explorer-studio.genlayer.com/tx/0xc8768a2266745c22b49a5cb5dc295f298f86d51e7bc69936cd727f66b2a7042b) | 3 agree, 0 disagree, 2 idle |
| STRANGER copies the revealed seal A into a claim: refused, L1 takes no claim until its owner seals new marks | STRANGER | [0x8506e521…](https://explorer-studio.genlayer.com/tx/0x8506e5210d01d21bcac7a7cd19bad25334f11046c1a930d209ff2556c5aee292) | 5 agree, 0 disagree, 0 idle |
| OWNER reseals L1 with seal B; it is open again | OWNER | [0xd72b8cfd…](https://explorer-studio.genlayer.com/tx/0xd72b8cfdb15790b486dc9e03cff1079df62f2138e488ae15b5b3fbe25e9cc4b5) | 3 agree, 0 disagree, 2 idle |
| GUESSER claims L1 again: it is a blue bag with some stuff inside | GUESSER | [0x9a4ad12b…](https://explorer-studio.genlayer.com/tx/0x9a4ad12bef7b1e536e49055e518561b614f5e9ad58e47838f7554b42930f904b) | 3 agree, 0 disagree, 2 idle |
| OWNER reveals seal B: no_match, too general to name any mark | OWNER | [0x86ad4374…](https://explorer-studio.genlayer.com/tx/0x86ad4374268b24e09519468cd62190a47f74997a37b491a52680d4b583b31834) | 3 agree, 0 disagree, 2 idle |
| OWNER reseals L1 with seal C | OWNER | [0xa199a642…](https://explorer-studio.genlayer.com/tx/0xa199a6422731dae72bd6ba4fbdec6cd8ab2eb2c6e4957037ca6a09e0f125d793) | 3 agree, 0 disagree, 2 idle |
| GUESSER tries a third claim: refused, one address claims an item at most twice | GUESSER | [0x106b7a1d…](https://explorer-studio.genlayer.com/tx/0x106b7a1dda927c4792efc2e85fd0ff3d242619630aace60ec21533aa07c33439) | 3 agree, 0 disagree, 2 idle |
| FINDER claims L1: a red tag that says TIDEPOOL, a green bottle with a crack in the side pocket | FINDER | [0xfcd9aadf…](https://explorer-studio.genlayer.com/tx/0xfcd9aadfb37ad96126b0a52165ae38a41bd5d05850593db83632229d06f1bfea) | 3 agree, 0 disagree, 2 idle |
| OWNER reveals seal C: the description names the tag and the bottle and contradicts nothing, match | OWNER | [0x4831f6ec…](https://explorer-studio.genlayer.com/tx/0x4831f6ec3a95e956eaf57912b70f377dc1c053f9721cf6f7d2f63c36ccd743ca) | 3 agree, 0 disagree, 1 idle |
| FINDER claims L1 again: refused, it is returned | FINDER | [0xdcafdcfd…](https://explorer-studio.genlayer.com/tx/0xdcafdcfd8ef1484b003d141e00802ac0411ff77ab5c9e314e91efada34e9420a) | 4 agree, 0 disagree, 1 idle |
| STRANGER defaults L2: OWNER never revealed, so the 0.2 GEN reward reaches FINDER as if it matched | STRANGER | [0x573ae1a9…](https://explorer-studio.genlayer.com/tx/0x573ae1a9344ae8642b2a9767fb5ec33a60d69e5c977bcdf73f61ccf8376a57e1) | 3 agree, 0 disagree, 2 idle |
| OWNER takes L3's 0.1 GEN back: its claim deadline passed with nobody claiming | OWNER | [0x6f0f0a78…](https://explorer-studio.genlayer.com/tx/0x6f0f0a781592f514bc6a5cf746bb217c42715edcafb1cc76921959c6d2371498) | 3 agree, 0 disagree, 2 idle |
| FINDER withdraws the two 0.02 GEN bonds that came back to credit | FINDER | [0x32bfafbc…](https://explorer-studio.genlayer.com/tx/0x32bfafbcc99cfd5a58afb2591360af2fd9d89b8af66732e7369d6088fb6064da) | 3 agree, 0 disagree, 2 idle |

## Licence

MIT. See `LICENSE`.
