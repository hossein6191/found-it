// What a visitor is told whenever they wait, in five plain lines: what is happening now, how long it
// takes or the exact time, whether they must act, whether they can leave, and where the money is. The
// same words for every in-between state of an item, for each of the three people who can be looking at
// it (its owner, the finder of its latest claim, anyone else), and for every wait the site itself
// causes: a wallet prompt, a transaction on its way, the validators judging, the demo bot at work.
//
// Pure, with no React: the state, the viewer's role and the numbers in, the words out. The waiting panel
// (components/wait-panel.tsx) renders a guide; tests/unit/guide.test.mjs runs every state for every
// role. Nothing here may promise what contracts/found_it.py does not do.

import { gen, span, when } from "./format.ts";
import { CLAIMS_PER_FINDER, CLAIM_BOND } from "./rules.ts";
import type { Claim, Item, WriteFn } from "./types.ts";

/** Who is looking: the item's owner, the finder of its latest claim, or anyone else. */
export type Role = "owner" | "finder" | "visitor";
export const ROLES: Role[] = ["owner", "finder", "visitor"];

/** Every state an item can be in, as a person waiting on it sees it. */
export type ItemState = "open" | "closed" | "pending" | "overdue" | "judging" | "match" | "no_match" | "unclear" | "default" | "withdrawn";
export const ITEM_STATES: ItemState[] = ["open", "closed", "pending", "overdue", "judging", "match", "no_match", "unclear", "default", "withdrawn"];

export type GuideTone = "busy" | "clock" | "act" | "ready" | "done";

export type Guide = {
  /** a stable name for the state, written on the panel for tests and tools */
  id: string;
  tone: GuideTone;
  /** the small line above the title */
  kicker: string;
  /** 1. what is happening now */
  now: string;
  /** 2. how long it takes, or the exact time */
  time: string;
  /** 3. whether the viewer must act, and what to do */
  need: string;
  mustAct: boolean;
  /** 4. whether the viewer can close the page, and where things stay */
  leave: string;
  canLeave: boolean;
  /** 5. where the money is right now, with the amounts */
  money: string;
  note?: string;
  /** seconds until the next thing happens on the contract's clock, for a countdown */
  left?: number;
  leftLabel?: string;
};

export const BOND = gen(CLAIM_BOND);

export type Ctx = {
  /** the reward in atto */
  reward: string;
  /** the contract's clock now */
  now: number;
  claimBy: number;
  revealSeconds: number;
  /** the pending or latest claim's reveal deadline */
  revealBy?: number;
  /** the owner is the demo bot */
  demo?: boolean;
  /** the in-memory demo build */
  mock?: boolean;
  /** how many claims the viewer has made on this item */
  myClaims?: number;
  /** when the item was settled or closed */
  closedAt?: number;
};

export const JUDGING_TIME = (mock?: boolean) =>
  mock ? "A few seconds in this demo build; usually 1 to 3 minutes on Studio, where every validator asks its own model." : "Usually 1 to 3 minutes: every validator asks its model four times, two framings in both orders.";
export const ABOUT_30 = (mock?: boolean) => (mock ? "A few seconds in this demo build; about 30 seconds on Studio." : "Usually about 30 seconds.");

const NOTHING = "Nothing is needed from you.";

/** Where the item stands, for the panel: the item, its latest claim, and whether a reveal is on its way. */
export function stateOf(item: Pick<Item, "status" | "now" | "claimBy" | "pending" | "returnedBy">, latest: Claim | null, judging = false): ItemState {
  if (judging && item.status === "claimed") return "judging";
  switch (item.status) {
    case "open":
      return item.now && item.now >= item.claimBy ? "closed" : "open";
    case "claimed":
      return item.pending && item.now && item.now >= item.pending.revealBy ? "overdue" : "pending";
    case "exposed":
      if (item.now && item.now >= item.claimBy) return "closed";
      return latest?.finding === "no_match" ? "no_match" : "unclear";
    case "returned":
      return latest?.finding === "default" ? "default" : "match";
    case "withdrawn":
      return "withdrawn";
  }
}

const mk = (id: string, g: Omit<Guide, "id">): Guide => ({ id, ...g });

export function itemGuide(state: ItemState, role: Role, c: Ctx): Guide {
  const reward = gen(c.reward);
  const id = `${state}:${role}`;
  const window = span(c.revealSeconds);
  const claimLeft = Math.max(0, c.claimBy - c.now);
  const revealLeft = c.revealBy ? Math.max(0, c.revealBy - c.now) : 0;
  const ownerName = c.demo ? "the demo owner" : "the owner";
  const Owner = c.demo ? "The demo owner" : "The owner";
  const again = (c.myClaims ?? 0) < CLAIMS_PER_FINDER;

  switch (state) {
    case "open":
      if (role === "owner")
        return mk(id, {
          tone: "clock",
          kicker: "On the shelf",
          now: "Your item is on the shelf with its hidden marks sealed. Anyone but you may claim it.",
          time: `Claims stay open until ${when(c.claimBy)}, ${span(claimLeft)} from now.`,
          need: `Nothing now. When a claim comes in you must reveal your marks and salt within ${window}, or the claim is paid anyway.`,
          mustAct: false,
          leave: `You can close the page, but come back: every claim gives you ${window} to answer.`,
          canLeave: true,
          money: `The ${reward} reward is held in escrow by the contract. No bond is staked.`,
          left: claimLeft,
          leftLabel: "claims open",
        });
      return mk(id, {
        tone: "ready",
        kicker: role === "finder" ? "Sealed again" : "Takes claims",
        now:
          role === "finder"
            ? `${Owner} sealed new marks after your last claim, so the item takes claims again.`
            : "This item is on the shelf with its hidden marks sealed. If you hold it, describe its marks to claim the reward.",
        time: `Claims are open until ${when(c.claimBy)}, ${span(claimLeft)} from now.`,
        need:
          role === "finder" && !again
            ? `Nothing: one address claims an item at most ${CLAIMS_PER_FINDER} times, and you have.`
            : `To claim, hold ${BOND} of credit for the bond, then describe at least two of the hidden marks.`,
        mustAct: false,
        leave: "You can close the page; nothing is waiting on you.",
        canLeave: true,
        money: `The ${reward} reward waits in escrow for a description the validators match.`,
        left: claimLeft,
        leftLabel: "claims open",
      });

    case "closed":
      return mk(id, {
        tone: role === "owner" ? "act" : "done",
        kicker: "Claims closed",
        now: role === "owner" ? "Claims on your item closed with no successful claim." : "Claims on this item closed with no successful claim.",
        time: `Claims closed at ${when(c.claimBy)}.`,
        need: role === "owner" ? `Take the ${reward} reward back with one signature, withdraw_reward(). It stays in escrow until you do.` : "Nothing: only the owner can take the reward back.",
        mustAct: role === "owner",
        leave: role === "owner" ? "You can close the page; the reward waits for you, it never expires." : "You can close the page.",
        canLeave: true,
        money: `The ${reward} reward is still in escrow, waiting for the owner to take it back.`,
      });

    case "pending":
      if (role === "owner")
        return mk(id, {
          tone: "act",
          kicker: "Your move",
          now: "A finder has claimed your item. Reveal your hidden marks and salt so the validators can judge the description.",
          time: `The reveal window closes in ${span(revealLeft)}, at ${when(c.revealBy ?? 0)}.`,
          need: `Yes: reveal before the window closes. If you do not, anyone may default the claim and the ${reward} reward goes to the finder.`,
          mustAct: true,
          leave: "Not until you have revealed: the window keeps running while the page is closed.",
          canLeave: false,
          money: `The ${reward} reward is in escrow and the finder's ${BOND} bond is staked.`,
          left: revealLeft,
          leftLabel: "to reveal",
        });
      return mk(id, {
        tone: "clock",
        kicker: c.demo ? "Waiting for the demo owner" : "Waiting for the owner",
        now:
          role === "finder"
            ? c.demo
              ? "Your claim is in. The demo owner reveals its marks and salt next, and the validators judge your description in that same transaction."
              : "Your claim is in. The owner must now reveal the hidden marks so the validators can judge your description."
            : `A claim on this item is pending: ${ownerName} must reveal the marks for it to be judged.`,
        time: `${Owner} has ${span(revealLeft)} to reveal, until ${when(c.revealBy ?? 0)}.`,
        need:
          role === "finder"
            ? c.demo
              ? `Nothing: the site asks the demo owner to reveal. If it never does, you may default the claim after ${when(c.revealBy ?? 0)} and be paid the reward.`
              : `Nothing yet. If ${ownerName} does not reveal in time, you may default the claim and be paid the reward.`
            : "Nothing: one claim is judged at a time, so the item takes the next once this one is settled.",
        mustAct: false,
        leave: role === "finder" ? "You can close the page: your claim and your bond stay on chain, and the result waits on the item's page." : "You can close the page.",
        canLeave: true,
        money: `The ${reward} reward is in escrow; ${role === "finder" ? "your" : "the finder's"} ${BOND} bond is staked.`,
        left: revealLeft,
        leftLabel: "reveal window",
      });

    case "overdue":
      if (role === "owner")
        return mk(id, {
          tone: "done",
          kicker: "Window closed",
          now: "Your reveal window closed. Anyone may now default the claim, which pays the finder the reward as if it matched.",
          time: `The window closed at ${when(c.revealBy ?? 0)}.`,
          need: "Nothing can change it now: a reveal is refused once the window has closed.",
          mustAct: false,
          leave: "You can close the page.",
          canLeave: true,
          money: `The ${reward} reward is still in escrow until somebody calls default(); then it goes to the finder.`,
        });
      return mk(id, {
        tone: role === "finder" ? "act" : "ready",
        kicker: role === "finder" ? "Your move" : "Open to anyone",
        now: role === "finder" ? `${Owner} did not reveal in time. Default the claim to be paid the reward.` : `${Owner} let the reveal window pass. Anyone may call default(); it pays only the finder.`,
        time: `The window closed at ${when(c.revealBy ?? 0)}; default() is open from then on.`,
        need:
          role === "finder"
            ? `Yes, to be paid: one signature, default(), sends you the ${reward} reward and puts your bond back in your credit.`
            : "Nothing, though you may call default() for the finder; it pays you nothing.",
        mustAct: role === "finder",
        leave: "You can close the page: the claim waits until somebody defaults it; it does not expire.",
        canLeave: true,
        money: `The ${reward} reward is in escrow; the ${BOND} bond is staked until the default.`,
      });

    case "judging":
      return mk(id, {
        tone: "busy",
        kicker: "The validators are judging",
        now:
          role === "finder"
            ? "The marks are revealed. Every validator is reading your description against them, in two framings and both orders."
            : role === "owner"
              ? "Your marks are on chain. Every validator is reading the finder's description against them, in two framings and both orders."
              : "The marks are revealed and the validators are judging the pending description.",
        time: JUDGING_TIME(c.mock),
        need: "Nothing: the page moves on by itself.",
        mustAct: false,
        leave: "You can close the page; the result is stored on the item either way.",
        canLeave: true,
        money: `The money moves in this same transaction: on a match the ${reward} reward to the finder; on no match the ${BOND} bond to the owner; on unclear the bond back to the finder.`,
      });

    case "match":
      return mk(id, {
        tone: "done",
        kicker: "Returned",
        now:
          role === "owner"
            ? "The validators matched the finder's description: your item is returned."
            : role === "finder"
              ? "Match. The validators agreed your description names the hidden marks: the reward is yours."
              : "The validators matched a finder's description: this item is returned.",
        time: `Settled at ${when(c.closedAt ?? 0)}.`,
        need: role === "owner" ? "Nothing on chain; arrange the handover with the finder." : role === "finder" ? "Nothing. Your bond is back in your credit; take it out on My items whenever you like." : NOTHING,
        mustAct: false,
        leave: "You can close the page: it is settled for good.",
        canLeave: true,
        money:
          role === "finder"
            ? `The ${reward} reward was paid to your wallet in the same transaction; your ${BOND} bond is back in your credit.`
            : `The ${reward} reward went to the finder; the ${BOND} bond went back to the finder's credit.`,
      });

    case "no_match":
      if (role === "owner")
        return mk(id, {
          tone: "act",
          kicker: "Waiting for new marks",
          now: "No match: the description named fewer than two marks or contradicted one. Your marks are public now.",
          time: c.demo ? "The demo owner reseals in about 30 seconds once asked." : "Nothing runs out but the claim deadline.",
          need: c.demo ? "Nothing from you: the demo owner seals the next marks of its rotation when asked." : "To take claims again, seal new marks nobody has seen with reseal(); until then the item takes no claim.",
          mustAct: !c.demo,
          leave: "You can close the page; the item waits, exposed, until new marks are sealed.",
          canLeave: true,
          money: `The finder's ${BOND} bond was paid to ${c.demo ? "the demo owner" : "you"}; the ${reward} reward is still in escrow.`,
        });
      return mk(id, {
        tone: "done",
        kicker: "No match",
        now:
          role === "finder"
            ? "No match: the validators found your description named fewer than two marks, or contradicted one."
            : "No match on the last claim: its marks are public now, so the item waits for new ones.",
        time: c.demo ? "The demo owner seals new marks within a minute once asked." : `It takes claims again once ${ownerName} seals new marks, any time before ${when(c.claimBy)}.`,
        need:
          role === "finder"
            ? again
              ? "Nothing. Once new marks are sealed you may claim it once more."
              : `Nothing: one address claims an item at most ${CLAIMS_PER_FINDER} times, and you have.`
            : "Nothing: a claim against public marks proves nothing, so none is taken until new marks are sealed.",
        mustAct: false,
        leave: "You can close the page.",
        canLeave: true,
        money: `${role === "finder" ? "Your" : "The"} ${BOND} bond was paid to the owner; the ${reward} reward stays in escrow.`,
      });

    case "unclear":
      if (role === "owner")
        return mk(id, {
          tone: "act",
          kicker: "Waiting for new marks",
          now: "Unclear: the four askings did not settle the description either way. Your marks are public now.",
          time: c.demo ? "The demo owner reseals in about 30 seconds once asked." : "Nothing runs out but the claim deadline.",
          need: c.demo ? "Nothing from you: the demo owner seals the next marks of its rotation when asked." : "To take claims again, seal new marks nobody has seen with reseal().",
          mustAct: !c.demo,
          leave: "You can close the page; the item waits, exposed, until new marks are sealed.",
          canLeave: true,
          money: `The ${BOND} bond went back to the finder's credit; the ${reward} reward is still in escrow.`,
        });
      return mk(id, {
        tone: "done",
        kicker: "Unclear",
        now: role === "finder" ? "Unclear: the four askings did not settle your description either way. No reward, and no loss." : "The last claim read unclear: its marks are public now, so the item waits for new ones.",
        time: c.demo ? "The demo owner seals new marks within a minute once asked." : `It takes claims again once ${ownerName} seals new marks, any time before ${when(c.claimBy)}.`,
        need: role === "finder" ? (again ? "Nothing. Once new marks are sealed you may claim it once more, more specifically." : `Nothing: one address claims an item at most ${CLAIMS_PER_FINDER} times, and you have.`) : NOTHING,
        mustAct: false,
        leave: "You can close the page.",
        canLeave: true,
        money: `${role === "finder" ? "Your" : "The"} ${BOND} bond went back to ${role === "finder" ? "your" : "the finder's"} credit; the ${reward} reward stays in escrow.`,
      });

    case "default":
      return mk(id, {
        tone: "done",
        kicker: "Paid by default",
        now:
          role === "owner"
            ? "You did not reveal within the window, so the claim was paid as if it matched."
            : role === "finder"
              ? `${Owner} did not reveal in time, so your claim was paid as if it matched.`
              : `${Owner} did not reveal in time, so the claim was paid as if it matched: hiding the marks saves nothing.`,
        time: `Settled at ${when(c.closedAt ?? 0)}.`,
        need: NOTHING,
        mustAct: false,
        leave: "You can close the page: it is settled for good.",
        canLeave: true,
        money: role === "finder" ? `The ${reward} reward is in your wallet; your ${BOND} bond is back in your credit.` : `The ${reward} reward went to the finder; the bond went back to the finder's credit.`,
      });

    case "withdrawn":
      return mk(id, {
        tone: "done",
        kicker: "Reward taken back",
        now: role === "owner" ? "You took the reward back after claims closed with no successful claim." : "Claims closed with no successful claim, and the owner took the reward back.",
        time: `Closed at ${when(c.closedAt ?? 0)}.`,
        need: NOTHING,
        mustAct: false,
        leave: "You can close the page: it is settled for good.",
        canLeave: true,
        money: role === "owner" ? `The ${reward} reward is back in your wallet.` : `The ${reward} reward went back to the owner.`,
      });
  }
}

// ---- the waits the site itself causes -----------------------------------------------------------------

const SIGN_WHAT: Record<WriteFn, string> = {
  deposit: "the deposit of credit for claim bonds",
  withdraw: "taking your credit back",
  post_lost: "posting your lost item with its reward",
  claim: "your claim",
  reveal: "revealing your marks and salt",
  default: "the default of the claim",
  reseal: "sealing new marks",
  withdraw_reward: "taking the reward back",
};

/** While the wallet asks. */
export function signGuide(fn: WriteFn, valueAtto = "0"): Guide {
  const sends = valueAtto !== "0";
  return mk(`sign:${fn}`, {
    tone: "act",
    kicker: "Your wallet is asking",
    now: `Your wallet is asking you to sign ${SIGN_WHAT[fn]}.`,
    time: "As long as you take; nothing is sent until you approve.",
    need: "Yes: approve or reject in the wallet window.",
    mustAct: true,
    leave: "Not yet: closing the page now leaves the wallet prompt unanswered, and nothing is sent.",
    canLeave: false,
    money: sends ? `${gen(valueAtto)} leaves your wallet only once you approve.` : "Nothing leaves your wallet: this call sends no value.",
  });
}

const SENDING_NOW: Record<WriteFn, string> = {
  deposit: "Your deposit is going through. It becomes credit you can stake as a claim bond.",
  withdraw: "Your credit is on its way back to your wallet.",
  post_lost: "Your item is going onto the shelf. The contract checks every field and holds the reward in escrow.",
  claim: "Your claim is going through. Its bond is staked from your credit and the owner's reveal window opens.",
  reveal: "The marks are on their way. The code checks them against the seal, then the validators judge the description.",
  default: "The default is going through: it pays the finder the reward.",
  reseal: "The new seal is going through. The item takes claims again once it is final.",
  withdraw_reward: "The reward is on its way back to the owner.",
};

const SENDING_MONEY: Record<WriteFn, (amount: string) => string> = {
  deposit: (a) => `${a} is moving from your wallet into your credit on the contract.`,
  withdraw: (a) => `${a} is moving from your credit back to your wallet.`,
  post_lost: (a) => `${a} is moving into escrow; a refusal returns all of it in the same transaction.`,
  claim: () => `${BOND} moves from your credit into the claim's bond; nothing leaves your wallet.`,
  reveal: () => "The reward or the bond moves in this same transaction, once the validators agree.",
  default: () => "The reward moves from escrow to the finder in this transaction.",
  reseal: () => "No value moves.",
  withdraw_reward: () => "The reward moves from escrow back to the owner in this transaction.",
};

/** While a transaction goes through. */
export function sendingGuide(fn: WriteFn, amountAtto = "0", mock?: boolean): Guide {
  return mk(`sending:${fn}`, {
    tone: "busy",
    kicker: fn === "reveal" ? "The validators are judging" : "On its way",
    now: SENDING_NOW[fn],
    time: fn === "reveal" ? JUDGING_TIME(mock) : ABOUT_30(mock),
    need: "Nothing: the page moves on by itself.",
    mustAct: false,
    leave: "You can close the page: the transaction goes on without it, and its result is on the item.",
    canLeave: true,
    money: SENDING_MONEY[fn](gen(amountAtto)),
  });
}

export type DemoAct = "asking" | "reveal" | "reseal" | "repost" | "claim";

/** While the demo bot works. */
export function demoGuide(act: DemoAct, reward = "0", mock?: boolean): Guide {
  const r = gen(reward);
  const lines: Record<DemoAct, { now: string; time: string; money: string }> = {
    asking: { now: "Asking the demo bot. It signs from the site's server with its own key.", time: "A few seconds.", money: "Nothing moves until it signs." },
    reveal: {
      now: "The demo owner is revealing its marks and salt for your claim; the validators judge your description in that same transaction.",
      time: JUDGING_TIME(mock),
      money: `On a match the ${r} reward is paid to you in this transaction; on no match your ${BOND} bond goes to the demo owner; on unclear it comes back to your credit.`,
    },
    reseal: { now: "The demo owner is sealing the next marks of its rotation, so the item takes claims again.", time: ABOUT_30(mock), money: `No value moves; the ${r} reward is still in escrow.` },
    repost: { now: "The demo owner is putting the item back on the shelf as a new item, with a fresh reward.", time: ABOUT_30(mock), money: `${r} moves from the demo owner into escrow.` },
    claim: { now: "The demo finder is claiming your item with the line you picked; your reveal window opens when it is final.", time: ABOUT_30(mock), money: `${BOND} moves from the demo finder's credit into the claim's bond.` },
  };
  const l = lines[act];
  return mk(`demo:${act}`, { tone: "busy", kicker: "The demo bot is at work", now: l.now, time: l.time, need: "Nothing: the page moves on by itself.", mustAct: false, leave: "You can close the page; the result is stored on the item either way.", canLeave: true, money: l.money });
}
