// The front of the shop: the promise in one minute, how the money moves, and where to start.

import Link from "next/link";

import { ButtonLink } from "@/components/button";
import { IconArrow } from "@/components/icons";
import { Parcel } from "@/components/parcel";
import { gen } from "@/lib/format";
import { CLAIM_BOND, MAX_REWARD, MIN_REWARD } from "@/lib/rules";

const STEPS = [
  {
    n: "1",
    head: "The owner posts and seals",
    body: "What anyone may know goes on the shelf: a navy backpack, the number 12 bus. What only the owner knows, three hidden marks, is sealed as one sha256 digest. The reward waits in escrow.",
  },
  {
    n: "2",
    head: "A finder describes it",
    body: `Anyone but the owner may claim, one claim at a time, staking a ${gen(CLAIM_BOND)} bond and writing what only the holder of the item would know. No model runs yet.`,
  },
  {
    n: "3",
    head: "The owner reveals; the network judges",
    body: "The owner reveals the marks and the salt, the code checks them against the seal, and every validator reads the description against them, two framings in both orders.",
  },
  {
    n: "4",
    head: "The money moves in that call",
    body: "A match pays the finder the reward. A description that names fewer than two marks, or gets one wrong, pays the owner the bond. If the owner never answers, the claim is paid anyway.",
  },
];

const MONEY = [
  { when: "Match", what: "The description names at least two marks and contradicts none.", money: "The reward to the finder; the bond back to the finder's credit.", tone: "text-green" },
  { when: "No match", what: "It names fewer than two, or it contradicts one.", money: "The bond to the owner; the reward stays in escrow.", tone: "text-twine-deep" },
  { when: "Unclear", what: "The four readings did not settle it either way.", money: "The bond back to the finder's credit; the reward stays.", tone: "text-ochre" },
  { when: "Not answered", what: "The owner let the reveal window pass.", money: "The reward to the finder, as if it matched.", tone: "text-green" },
  { when: "Nobody found it", what: "Claims close with no successful claim.", money: "The reward back to the owner.", tone: "text-ink-2" },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-14">
      <section className="grid items-end gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="head text-[13px] font-bold tracking-[0.16em] text-twine-deep uppercase">Lost property, with a reward</p>
          <h1 className="mt-2 text-[38px] font-bold sm:text-[54px]">The reward goes only to whoever can describe what is inside.</h1>
          <p className="mt-4 max-w-[38rem] text-[18px] text-ink-2">
            The owner seals the item&apos;s hidden marks before anybody claims it. A finder describes them. GenLayer&apos;s validators decide whether the description proves the find, and the reward moves in the same
            transaction. The owner never gets to say no to keep the money.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/found" icon={<IconArrow />}>
              I found something
            </ButtonLink>
            <ButtonLink href="/lost" variant="kraft">
              I lost something
            </ButtonLink>
          </div>
          <p className="mt-3 text-[14px] text-ink-3">The demo shelf holds three lost items. One wallet is enough to play the finder, and the owner too.</p>
        </div>
        <div className="shelf" aria-hidden="true">
          <div className="shelf-bay grid grid-cols-3 items-end gap-2">
            <Parcel id="L12" status="open" size={170} />
            <Parcel id="L7" status="returned" size={170} />
            <Parcel id="L9" status="exposed" size={170} />
          </div>
          <div className="plank" />
          <div className="shelf-bay grid grid-cols-3 items-end gap-2">
            <Parcel id="L3" status="claimed" size={170} />
            <span />
            <Parcel id="L5" status="open" size={170} />
          </div>
          <div className="plank" />
        </div>
      </section>

      <section aria-labelledby="minute">
        <h2 id="minute" className="text-[28px] font-bold">
          The promise in one minute
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="sheet flex flex-col gap-2 px-4 pt-3 pb-4">
              <span className="stencil text-[30px] leading-none">{s.n}</span>
              <h3 className="text-[18px] font-bold">{s.head}</h3>
              <p className="text-[15px] text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="money" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          <h2 id="money" className="text-[28px] font-bold">
            How the money moves
          </h2>
          <p className="mt-3 text-[16px] text-ink-2">
            A reward is {gen(MIN_REWARD)} to {gen(MAX_REWARD)}, held by the contract from the post. Every claim stakes a {gen(CLAIM_BOND)} bond from credit the finder deposited first. Every settlement makes at most one
            transfer, in the call that settles it.
          </p>
          <p className="mt-3 text-[16px] text-ink-2">
            A judged claim makes the marks public, so the item waits until its owner seals new ones. Each seal is judged against one claim only: nobody can copy marks that were revealed.
          </p>
        </div>
        <div className="sheet overflow-hidden">
          <table className="w-full text-left text-[14.5px]">
            <thead className="bg-room-2">
              <tr>
                <th scope="col" className="head px-3 py-2 font-bold">
                  When
                </th>
                <th scope="col" className="head px-3 py-2 font-bold">
                  The money, in the same call
                </th>
              </tr>
            </thead>
            <tbody>
              {MONEY.map((m) => (
                <tr key={m.when} className="border-t border-line align-top">
                  <th scope="row" className="px-3 py-2.5 font-normal">
                    <span className={`head block font-bold ${m.tone}`}>{m.when}</span>
                    <span className="block text-[13.5px] text-ink-3">{m.what}</span>
                  </th>
                  <td className="px-3 py-2.5 text-ink-2">{m.money}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="why" className="sheet grid gap-4 px-5 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <h2 id="why" className="text-[24px] font-bold">
            Why not just ask the owner?
          </h2>
          <p className="mt-2 text-[16px] text-ink-2">
            Because the owner keeps the reward when the answer is no. And a string match fails the honest finder who writes &ldquo;a red tag that says TIDEPOOL&rdquo; for &ldquo;a red luggage tag reading TIDEPOOL&rdquo;. Whether a
            description names a mark is a judgement about meaning; here every validator makes it for itself and only a finding they agree on moves money.
          </p>
        </div>
        <Link href="/how" className="link head font-bold whitespace-nowrap">
          The questions, word for word
        </Link>
      </section>
    </div>
  );
}
