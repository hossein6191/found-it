// One builder per write method of the contract: the method's name, its arguments in the contract's
// order, and the value sent. Pure, so tests/unit/interface.test.mjs checks every builder against the
// signatures in contracts/found_it.py with no browser and no network.

import type { Call } from "./types.ts";

const int = (n: number): number => Math.trunc(n);

export const calls = {
  /** deposit(), payable: hold value as credit for your own claim bonds. */
  deposit: (valueAtto: bigint): Call => ({ fn: "deposit", args: [], value: valueAtto }),
  /** withdraw(amount_atto): take back part or all of your own credit. The amount travels as digits. */
  withdraw: (amountAtto: bigint): Call => ({ fn: "withdraw", args: [amountAtto.toString()] }),
  /** post_lost(title, public_description, marks_digest, reveal_seconds, claim_by), payable: the value is the reward. */
  postLost: (title: string, publicDescription: string, marksDigest: string, revealSeconds: number, claimBy: number, rewardAtto: bigint): Call => ({
    fn: "post_lost",
    args: [title, publicDescription, marksDigest, int(revealSeconds), int(claimBy)],
    value: rewardAtto,
  }),
  /** claim(item, description): anyone but the owner; the bond is staked from credit. */
  claim: (item: string, description: string): Call => ({ fn: "claim", args: [item, description] }),
  /** reveal(item, hidden_marks, salt): the owner, within the pending claim's reveal window; judged in the same call. */
  reveal: (item: string, hiddenMarks: string, salt: string): Call => ({ fn: "reveal", args: [item, hiddenMarks, salt] }),
  /** default(item): anyone, once the pending claim's reveal window has passed. */
  default: (item: string): Call => ({ fn: "default", args: [item] }),
  /** reseal(item, marks_digest): the owner, while the item is exposed. */
  reseal: (item: string, marksDigest: string): Call => ({ fn: "reseal", args: [item, marksDigest] }),
  /** withdraw_reward(item): the owner, from claim_by, with no successful claim and none pending. */
  withdrawReward: (item: string): Call => ({ fn: "withdraw_reward", args: [item] }),
};
