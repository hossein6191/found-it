# Decisions

The boundary first, then the questions, the prompt, the seal and why a seal is
judged once, the money, the bounds, the doors, the demonstration, then what is
verified and what is not.

## 1. The boundary: what the network agrees on

**One word.** The round stores `{"finding": "match" | "no_match" | "unclear"}`
and nothing else. What has to be decided is whether a description proves the
find, and a closed set of three words is the coarsest answer that carries it
while leaving room for "cannot tell". A score of how close a description came,
or a quotation of the mark it missed, would put values in storage that honest
nodes could reach differently while believing the same thing.

**Three words, not two.** "It has a red tag and a bottle in the side pocket"
neither proves the find nor shows a guess: it is too thin to say. A two-valued
answer would push it to one side, and either side moves money wrongly: the
reward for a lucky guess, or the bond forfeited by a finder who wrote briefly.
So the round has a third value, and the money treats it as the honest middle:
no reward, the bond back.

**What a program can check, the program checks.** Whether the revealed marks
and salt open the seal; whether the sender is the owner; whether a claim is
pending and its window open; whether this address has claimed twice; whether
the credit holds the bond; whether claims are still open: every one of these is
decided in code before any model is asked. The network is asked only what code
cannot answer: does this description name these marks.

**It never sees money or people.** `_asking` takes the hidden marks, the one
description, a framing and an order. No amount, no address, no title, no public
description and no id is a parameter, and a test checks that none appears in
any prompt.

## 2. The questions

**The specified questions were compound, so each is two.** The design asked
MATCHES as "Does the FINDER'S DESCRIPTION correctly name at least two of the
HIDDEN MARKS, with nothing in it that contradicts them?" and GUESS as "Does the
FINDER'S DESCRIPTION fail to identify the item, because it names fewer than two
of the HIDDEN MARKS, gets one wrong, or stays too general to tell?". The first
joins a count and a contradiction; the second joins three reasons with "or". A
reader can satisfy one half and not the other, and a single yes or no to a
conjunction hides which half it weighed. So each framing asks two questions
with one condition each (names at least two; free of contradiction; names fewer
than two; contains a contradiction), and the code combines them. "Too general
to tell" is not a third condition: `SCOPE` says a general description names no
mark, so it is the count failing. A static test fails on any " and ", " or " or
", with" in a question.

**Two framings, mirror images.** GUESS is MATCHES negated, asked in an asking
of its own, so a reader that agrees with whatever it is asked says yes to both
and settles nothing. Each condition is read four ways: it holds only on yes,
yes from MATCHES and no, no from GUESS, and fails only on the reverse. A match
needs both to hold; a no_match needs either to fail, because a description that
names two marks and gets a third wrong has still not proved the find, and a
description that names none has proved nothing whether or not it is wrong.
Anything else is unclear, an unreadable asking included. This is stricter than
the design's combine rule, which accepted MATCHES no and GUESS yes for
different reasons: here the same condition must fail in all four readings.

**Both orders.** Every node builds the prompts the same way, so a reader that
favours the block it reads first favours it on every node, and consensus alone
would never see it. Each framing is asked with the marks first and with the
description first. A reader led by the order answers differently in the two,
and the condition it was led on settles nothing.

**All four in one block, every call inside the closure.** Nested nondet blocks
are not legal, and separate blocks would be separate rounds that could settle
differently. One leader closure asks all four sequentially and combines them in
code. Every `gl.nondet.exec_prompt` call is written inside that closure, and a
static test fails on a `gl.nondet` call anywhere else in the file.

**Words parsed strictly.** An answer counts only as the JSON string `yes`, `no`
or `unclear` under its own key, trimmed, in any case. A boolean, a number,
"true", "Yes." and "Yes, mostly" are unreadable, and so is a reply missing
either key: an unreadable asking is never repaired into an answer. Keys the
contract did not ask for are ignored; their values are never read. A JSON
fraction is refused by the parser hook before it is built.

**Exact equality, and no agreement with an error.** There is no tolerance
anywhere: validators compare the finding by exact string equality. A validator
whose own rerun raises disagrees; a leader that raised is never agreed with. A
round no majority carries stores nothing; the claim stays pending, and the owner
sends the reveal again within the window.

## 3. The prompt

**The fence and the tag.** The marks and the description pass through `_fence`,
which replaces `<` with `(` and `>` with `)` and never deletes. Each sits between
two delimiter lines tagged with the first 16 hex characters of the sha256 of its
own fenced body. A finder writes the description and can compute its tag; once
fenced it holds no angle bracket and cannot write a line that starts with
`<<<`. A test plants a forged closing line and an opening line inside a
description and finds exactly the four delimiters the contract wrote. The labels
on the delimiter lines are contract constants; no id or name reaches them.

**ASCII on one line at the door.** The fence knows only the two ASCII brackets,
and Unicode has look-alikes a model reads as brackets, so the door refuses
anything outside printable ASCII. Every character as sent is walked, not only
the trimmed text, so not even a line break at the end of the marks passes.

**Nothing judged is sampled.** Every text over its cap is refused at the door,
so the round reads the marks and the description whole. The largest possible
prompt is 3,316 characters.

## 4. The seal, and why each seal is judged once

**Why sealed.** A claimant who could read the marks would copy them. So the
owner commits them when posting, as `sha256(hidden_marks + "|" + salt)`, and
reveals them only to judge a pending claim. The marks are hashed exactly as they
will be revealed and judged, spaces at the ends included, so the text stored is
the text sealed and the text judged. The salt is 16 to 64 letters and digits.

**The specified design reopened the item on public marks.** It sent a failed or
unclear claim's item back to `open`, and the next claim was to be judged
against the same marks, which the reveal had just made public. Anybody could
then copy them into a claim, and the owner could only reveal (a match pays the
copier) or stay silent (the default pays the copier). Worse, one person could
make the first claim on purpose with garbage from one address, lose 0.02 GEN,
read the marks off the reveal and claim the reward from a second address. The
fix keeps everything else the design says: a judged claim that does not match
leaves the item `exposed`, taking no claim, and `reseal(item, marks_digest)`
lets the owner seal new marks and open it again. Each seal is therefore judged
against at most one claim, `CLAIMS_PER_FINDER` still means two tries per
address on one item, and no description is judged twice against the same
marks. The design's own recourse, posting a new item with new marks, remains
possible; resealing keeps the escrow and the item's history in one place.

**No digest twice.** `sealed_rows` remembers every digest an item has sealed,
and `reseal` refuses one it has seen, so the owner cannot reopen an item on
marks already public by mistake. The contract cannot see the marks inside a new
digest; sealing revealed marks under a new salt is a limit stated in `rules()`.

**Hiding never pays.** If the owner does not reveal within the window, anyone
may call `default(item)` and the claim is paid the reward as if it matched. An
owner who saw an accurate description cannot escape by silence; an owner who
saw a guess reveals, and the guess forfeits its bond.

## 5. The money

**Pay in the call that decides.** `reveal()` settles the claim it judged: the
reward and the bond back, the bond to the owner, or the bond back alone. At
most one transfer, after everything is written. `default()` pays the reward
and returns the bond. `withdraw_reward()` returns an unwon reward. No other call
moves value except `withdraw()` and a refused payable.

**Bonds from credit.** A claim stakes its bond from credit deposited
beforehand, so `claim()` carries no value and a refused claim strands nothing.
A returned bond goes back to credit; the finder withdraws it at will.

**Payable calls never raise.** `post_lost()` and `deposit()` check everything
first and return everything sent with a reason on any refusal; neither reaches
`_fail`, `_clock` or the round. The clock is read with `_now()`, which returns
-1 rather than raising, and a missing clock is a refusal with a refund.

**Nothing waits for ever.** A pending claim ends by reveal or default; an open
or exposed item ends by withdraw_reward at `claim_by`; credit ends by withdraw.
The suite drains eighty random journeys to a balance of zero.

## 6. The bounds, and no cap a stranger can fill

No write contains a loop; the three paged views loop at most `PAGE_CAP` times;
every other loop reads one capped argument. No settlement reads a list, and a
test counts the storage reads of a settlement after sixty earlier claims and
finds the same number as after none. One claim pending at a time is the
design's rule: a stranger can hold the slot only by staking a bond, which the
owner answers by revealing at once, and which pays the owner when it fails.
`CLAIMS_PER_FINDER` is a dedupe per address, never a count that closes the item
to anybody else.

## 7. The doors

`claim_by` is a unix time ten minutes to 365 days ahead. The ceiling is a guard
the design did not name: an unbounded integer would overflow its `u64` field
and raise inside a payable call after the value had arrived. Ids are exactly
the contract's own (`L` or `C`, then 1 to 9 digits with no leading zero), and
every id or address argument longer than 64 characters is read as nothing.

## 8. The demonstration

The specified demonstration judged three claims against one set of marks. With
each seal judged once, the on-chain run gives the backpack three seals instead:
seal A (the library card for Mara Quist, a spare key) meets "A red tag reading
HARBOUR and a library card for Ines Corrie", which contradicts the card; seal B
(a broken zip pull, a heron sticker) meets "It is a blue bag with some stuff
inside", which names nothing; seal C (the TIDEPOOL tag, the cracked green
bottle, a bus map) meets the finder's "It has a red tag that says TIDEPOOL and a
green bottle with a crack in the side pocket". The finder's marks are never
revealed before the finder's claim. The offline suite also judges all three
claims against the specified marks, each on its own item, and reads them as
specified. A second item, an umbrella, shows the default; a third, a scarf,
shows a reward taken back. The suite reads the smoke's texts out of the file
and checks they are the texts it judges.

## 9. Views

Every view takes ids, small integers or an address, at most 64 characters each.
`item` reports `now`, the message clock, so a caller waits for a window by the
chain's own clock, and says whether the item is claimable, defaultable,
resealable or withdrawable at that instant. `claims_of` shows each claim with
the seal it met and the marks it was judged against.

## 10. Verified, and not verified

**Verified here, offline, with no network:** 229 tests, green. The round is
driven with a scripted model per node: every cell of the combine rule, a reader
led by the order, readers that affirm everything, deny everything or answer
garbage, booleans and fractions in replies, one validator outvoted, a majority
in another world storing nothing, a validator whose own rerun raises, and a
leader that raised writing nothing. Eighty seeded random journeys check the
books after every step and drain to zero. 220 defences removed or inverted one
at a time, none surviving, each with the test that caught it named in
`tests/MUTATIONS.md`. `genvm-lint` 0.11.0 passes with exit code 0.

**Verified by construction, through static checks over the parsed source:**
every model call is written inside the one leader closure, four askings, one
for each pairing of the two framings with the two orders, combined through
`_combine`; there is one round, not nested, run only in `reveal` after every
refusal and before every write; each question asks one condition; the
validator is one line delegating to the comparison, which refuses a leader
error first and compares by exact equality; every write either refuses by
sender or is listed with its reason (`deposit`, `post_lost`, `default`); the
payable writes reach no raise and no round; the seal is checked in code before
the round; a judged claim leaves the item exposed, and only a digest the item
never sealed opens it again; the delimiter is written in one place and carries
the body's hash; every value interpolated into a prompt is fenced or a contract
constant; the one `json.loads` refuses floats; no float, no true division, no
`datetime`; every loop is bounded; storage holds scalars only; views take only
short arguments; the file pins the runner in its first line; no personal or
internal detail appears anywhere in the repository.

**Verified on chain:** not yet. The on-chain run is recorded in the README once
it has run.

**Not verified:** how a live model reads the demonstration, in particular
whether "a red tag that says TIDEPOOL" counts as naming "a red luggage tag
reading TIDEPOOL", whether a guess that is silent about a mark is read as
neutral rather than wrong, and whether "a blue bag" is read as naming nothing
against marks that never mention the bag; how often a borderline description
splits validators, leaving a reveal to be sent again; and which model the
validators run.
