// The contract's rules() answer, word for word, as contracts/found_it.py returns it: the in-memory contract of
// mock mode answers with this, and tests/unit/interface.test.mjs asks the contract itself and compares it whole.

export const CONTRACT_RULES = {
  "value": "{\"finding\": \"match\" | \"no_match\" | \"unclear\"}, compared by exact string equality",
  "questions": {
    "matches": {
      "names_two": "Does the FINDER'S DESCRIPTION correctly name at least two of the HIDDEN MARKS? Answer yes, no or unclear.",
      "nothing_wrong": "Is the FINDER'S DESCRIPTION free of any statement that contradicts the HIDDEN MARKS? Answer yes, no or unclear."
    },
    "guess": {
      "fewer_than_two": "Does the FINDER'S DESCRIPTION correctly name fewer than two of the HIDDEN MARKS? Answer yes, no or unclear.",
      "something_wrong": "Does the FINDER'S DESCRIPTION contain a statement that contradicts the HIDDEN MARKS? Answer yes, no or unclear."
    }
  },
  "askings": [
    "matches/marks_first: the HIDDEN_MARKS block first; the two MATCHES questions",
    "matches/description_first: the FINDER_DESCRIPTION block first; the two MATCHES questions",
    "guess/marks_first: the HIDDEN_MARKS block first; the two GUESS questions",
    "guess/description_first: the FINDER_DESCRIPTION block first; the two GUESS questions"
  ],
  "reading": "an answer counts only as the JSON string yes, no or unclear under its own key; a boolean, a number, any other word and a missing key are unreadable, and an asking with an unreadable answer settles neither condition",
  "combine": {
    "names two marks holds": "names_two yes in both orders, fewer_than_two no in both orders",
    "names two marks fails": "names_two no in both orders, fewer_than_two yes in both orders",
    "contradicts none holds": "nothing_wrong yes in both orders, something_wrong no in both orders",
    "contradicts none fails": "nothing_wrong no in both orders, something_wrong yes in both orders",
    "match": "both conditions hold",
    "no_match": "either condition fails",
    "unclear": "anything else, an unreadable asking included"
  },
  "compared": "the finding, by exact string equality; every validator reruns all four askings inside try/except, disagrees if its own rerun raises, and never agrees with a leader that raised",
  "not_asked": "no amount, no address, no title, no public description and no id is ever shown to the model; it reads the hidden marks and the one description it judges, and nothing else",
  "money": {
    "deposit": "payable, no model; the value is held as the sender's credit for claim bonds",
    "post_lost": "payable, no model; the value is the reward, 50000000000000000 to 50000000000000000000 atto, held in escrow; a refusal returns everything sent",
    "claim": "not payable; stakes the claim bond, 20000000000000000 atto, from the finder's credit",
    "reveal, match": "the reward to the finder, the bond back to the finder's credit; the item returned",
    "reveal, no_match": "the bond to the owner; the item exposed until its owner seals new marks",
    "reveal, unclear": "the bond back to the finder's credit; the item exposed until its owner seals new marks",
    "default": "after the reveal window with no reveal: the reward to the finder and the bond back to the finder's credit, as if it matched",
    "withdraw_reward": "after claim_by, with no successful claim and none pending: the reward back to the owner",
    "withdraw": "the sender's own credit, any part of it, back to the sender",
    "reseal": "no value moves",
    "refusals": "a refused deposit or post_lost returns everything it sent; every other refusal raises and took nothing"
  },
  "settlement": "pay as you go: every claim is settled in its own call, reveal() or default(), with at most one transfer, and no call walks the claims; items(), items_of() and claims_of() page at 20",
  "windows": "claim() while the item is open and now is before claim_by; reveal() by the owner from the claim until its reveal_by, the claim time plus the item's reveal_seconds; default() by anyone from reveal_by; reseal() by the owner while the item is exposed and before claim_by; withdraw_reward() by the owner from claim_by while the item is open or exposed",
  "who": {
    "deposit": "anyone, for their own address",
    "withdraw": "anyone, for their own credit",
    "post_lost": "anyone; the sender is the owner",
    "claim": "anyone but the owner, one claim pending at a time, at most 2 claims per address per item",
    "reveal": "only the owner, once per claim, within its reveal window",
    "default": "anyone, once the reveal window has passed; it pays only the finder",
    "reseal": "only the owner, while the item is exposed",
    "withdraw_reward": "only the owner, once"
  },
  "seal": "marks_digest = sha256(hidden_marks + \"|\" + salt), the hidden marks exactly as they will be revealed, and the salt 16 to 64 ASCII letters and digits; each seal is judged against at most one claim, and an item never seals a digest twice",
  "sizes": {
    "title": [
      3,
      80
    ],
    "public_description": [
      20,
      300
    ],
    "description": [
      20,
      500
    ],
    "hidden_marks": [
      20,
      500
    ],
    "salt": [
      16,
      64
    ],
    "reward_atto": [
      "50000000000000000",
      "50000000000000000000"
    ],
    "reveal_seconds": [
      600,
      604800
    ],
    "claim_by_ahead_seconds": [
      600,
      31536000
    ],
    "claim_bond_atto": "20000000000000000",
    "claims_per_finder": 2,
    "page": 20
  },
  "limits": [
    "the contract cannot see the item: it judges whether the finder knows what only somebody holding the real item would know, and pays for that proof; the handover happens off chain",
    "an owner who writes vague marks gets vague answers: a mark a guess could name proves nothing, and a mark nobody could find without the owner's memory may defeat an honest finder",
    "once revealed, the marks are public: that is why a judged claim leaves the item exposed, taking no claim until its owner seals new marks, and why a seal is never judged twice",
    "hiding the marks never saves the owner money: a claim the owner does not answer within the reveal window is paid as if it matched",
    "a reveal whose round the network does not carry stores nothing; the owner sends it again within the window, and a window that runs out pays the claim",
    "the owner can take the reward back early through a second address that claims and is never answered: the reward binds the owner's own marks, not the owner's goodwill",
    "a new seal must hold marks never revealed: the contract refuses a digest the item sealed before, but cannot see the marks inside a new one",
    "English, in printable ASCII, on one line"
  ],
  "untrusted": "the hidden marks and the description are printable ASCII on one line, fenced (< and > replaced, never deleted) and placed between delimiter lines tagged with the sha256 of their own fenced text; the prompt says, before the blocks, that both are untrusted"
};
