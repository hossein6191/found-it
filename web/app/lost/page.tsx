"use client";

// Posting a lost item, as its owner: what anyone may know (a title and a public description), what only
// you know (the hidden marks, sealed here as sha256(marks + "|" + salt) with a salt made in this
// browser), the reward, the reveal window every claim gives you, and when claims close. Every field has
// one-click suggestions and the contract's own limits as you type. The marks and the salt are kept in
// this browser's storage when you send, with a plain warning to copy them. Once the item is on the
// shelf, the demo finder can claim it from the item's page, so one wallet can play the owner too.

import * as React from "react";
import Link from "next/link";

import { Button, ButtonLink } from "@/components/button";
import { Parcel } from "@/components/parcel";
import { SealEditor, useSealDraft } from "@/components/seal-editor";
import { Suggest } from "@/components/suggest";
import { TxStage } from "@/components/tx-stage";
import { useNow } from "@/components/use-now";
import { useTx } from "@/components/use-tx";
import { WalletGate } from "@/components/wallet-gate";
import { calls, isMock, itemPath, postedItem, refundOf } from "@/lib/chain";
import { gen, span, toAtto, when } from "@/lib/format";
import { sendingGuide, signGuide } from "@/lib/guide";
import { attachItem, saveSeal } from "@/lib/local-seals";
import { MAX_PUBLIC, MAX_REWARD, MAX_TITLE, MIN_REWARD, publicProblem, pyLen, sentence, titleProblem } from "@/lib/rules";
import { CLAIM_AHEAD_CHIPS, PUBLIC_CHIPS, REVEAL_CHIPS, REWARD_CHIPS, TITLE_CHIPS } from "@/lib/suggestions";
import { rememberTx } from "@/lib/tx-memory";

export default function LostPage() {
  const [title, setTitle] = React.useState("");
  const [pub, setPub] = React.useState("");
  const [reward, setReward] = React.useState("0.1");
  const [reveal, setReveal] = React.useState(3600);
  const [ahead, setAhead] = React.useState(7 * 86400);
  const draft = useSealDraft();
  const clock = useNow();
  const [posted, setPosted] = React.useState("");
  const [sent, setSent] = React.useState<{ digest: string } | null>(null);
  const tx = useTx((s, hash) => {
    const id = postedItem(s);
    if (id && sent) {
      attachItem(sent.digest, id);
      rememberTx(id, hash, "post_lost");
      setPosted(id);
    }
  });

  const rewardAtto = toAtto(reward);
  const tProblem = title ? titleProblem(title) : "";
  const pProblem = pub ? publicProblem(pub) : "";
  const rProblem = rewardAtto === null ? "write the reward in GEN, such as 0.1" : rewardAtto < MIN_REWARD || rewardAtto > MAX_REWARD ? "the reward is 0.05 to 50 GEN" : "";
  const ready = clock > 0 && !!title && !!pub && !tProblem && !pProblem && !rProblem && !!draft.digest;
  const busy = tx.sending || (!!tx.hash && !tx.final);
  const refund = tx.final ? refundOf(tx.final) : null;

  const send = () => {
    if (!ready || rewardAtto === null) return;
    // The claim deadline is counted from now; the contract measures it against its own clock and needs it ten minutes ahead at least.
    const claimBy = clock + ahead;
    saveSeal({ digest: draft.digest, marks: draft.marks.trim(), salt: draft.salt, title: title.trim(), item: "" });
    setSent({ digest: draft.digest });
    void tx.start(calls.postLost(title.trim(), pub.trim(), draft.digest, reveal, claimBy, rewardAtto));
  };

  if (posted)
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 py-6 text-center">
        <div className="shelf w-full max-w-sm">
          <div className="shelf-bay flex justify-center">
            <Parcel id={posted} status="open" size={220} title={title} />
          </div>
          <div className="plank" />
        </div>
        <h1 className="text-[32px] font-bold">{posted} is on the shelf</h1>
        <p className="text-[16px] text-ink-2">
          Its marks are sealed and the reward is in escrow. Watch for claims: each one gives you {span(reveal)} to reveal, or it is paid anyway. Your marks and salt are kept in this browser; copy them if you have not.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink href={itemPath(posted)}>Open {posted} and have the demo finder claim it</ButtonLink>
          <ButtonLink href="/mine" variant="paper">
            Mine
          </ButtonLink>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-7">
      <header className="max-w-[46rem]">
        <p className="head text-[13px] font-bold tracking-[0.16em] text-twine-deep uppercase">Play the owner</p>
        <h1 className="mt-1 text-[34px] font-bold sm:text-[44px]">Post a lost item</h1>
        <p className="mt-3 text-[17px] text-ink-2">
          Say what anyone may know, and seal what only someone holding it would see. Nobody claiming it can read the marks; you reveal them only to have a claim judged, and the validators decide, not you.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="sheet flex min-w-0 flex-col gap-6 px-4 py-5 sm:px-6">
          <fieldset className="flex flex-col gap-4">
            <legend className="head mb-1 text-[19px] font-bold">What anyone may know</legend>
            <div>
              <label htmlFor="lost-title" className="label">
                Title
              </label>
              <input id="lost-title" className="field mt-1.5" maxLength={MAX_TITLE} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What, and where" />
              <Hint problem={tProblem} count={`${pyLen(title)} / ${MAX_TITLE}`} plain="3 to 80 characters." />
              <Suggest label="Suggested titles" chips={TITLE_CHIPS} onPick={setTitle} isOn={(v) => v === title} />
            </div>
            <div>
              <label htmlFor="lost-public" className="label">
                Public description
              </label>
              <textarea id="lost-public" className="field mt-1.5 min-h-[80px]" maxLength={MAX_PUBLIC} value={pub} onChange={(e) => setPub(e.target.value)} placeholder="Where and when it was lost, what it looks like from the outside" />
              <Hint problem={pProblem} count={`${pyLen(pub)} / ${MAX_PUBLIC}`} plain="Anyone reads this. Nothing a finder would have to prove." />
              <Suggest label="Suggested public descriptions" chips={PUBLIC_CHIPS} onPick={setPub} isOn={(v) => v === pub} />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-4">
            <legend className="head mb-1 text-[19px] font-bold">What only you know</legend>
            <SealEditor draft={draft} id="lost" title={title} />
          </fieldset>

          <fieldset className="flex flex-col gap-4">
            <legend className="head mb-1 text-[19px] font-bold">The reward and the windows</legend>
            <div>
              <label htmlFor="lost-reward" className="label">
                Reward, in GEN
              </label>
              <input id="lost-reward" className="field mono mt-1.5 max-w-[12rem]" inputMode="decimal" value={reward} onChange={(e) => setReward(e.target.value)} />
              <Hint problem={rProblem} plain="0.05 to 50 GEN, held in escrow from the post." />
              <Suggest label="Suggested rewards" chips={REWARD_CHIPS.map((c) => ({ ...c, value: gen(c.value).replace(" GEN", "") }))} onPick={setReward} isOn={(v) => v === reward} />
            </div>
            <div>
              <p className="label">Reveal window</p>
              <p className="mt-0.5 text-[14px] text-ink-2">How long each claim gives you to reveal the marks. Miss it and the claim is paid as if it matched.</p>
              <Suggest label="Reveal windows" chips={REVEAL_CHIPS} onPick={setReveal} isOn={(v) => v === reveal} />
            </div>
            <div>
              <p className="label">Claims close</p>
              <p className="mt-0.5 text-[14px] text-ink-2">After this, with no successful claim, you take the reward back.</p>
              <Suggest label="Claim deadlines" chips={CLAIM_AHEAD_CHIPS} onPick={setAhead} isOn={(v) => v === ahead} />
              {clock > 0 && <p className="mt-1.5 text-[13.5px] text-ink-3">Claims would close at {when(clock + ahead)}.</p>}
            </div>
          </fieldset>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <div className="sheet px-4 py-4">
            <h2 className="text-[19px] font-bold">Before you post</h2>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[14.5px] text-ink-2">
              <li>The reward, {rewardAtto !== null && !rProblem ? gen(rewardAtto) : "…"}, leaves your wallet into escrow. A refused post returns all of it.</li>
              <li>Each claim stakes a 0.02 GEN bond. A claim that does not match pays you that bond.</li>
              <li>Every judged claim makes your marks public; then you seal new ones to take claims again.</li>
              <li>Your marks and salt stay in this browser only. Copy them.</li>
            </ul>
            <div className="mt-4">
              <WalletGate doing="post your item">
                <Button block disabled={!ready || busy} onClick={send}>
                  Post it with {rewardAtto !== null && !rProblem ? gen(rewardAtto) : "the reward"}
                </Button>
              </WalletGate>
              {!ready && <p className="mt-2 text-[13px] text-ink-3">Fill in the title, the public description and the marks, and the button wakes up.</p>}
            </div>
          </div>
          <TxStage tx={tx} sign={signGuide("post_lost", rewardAtto?.toString() ?? "0")} sending={sendingGuide("post_lost", rewardAtto?.toString() ?? "0", isMock)} label="Posting your lost item" />
          {refund && (
            <p role="alert" className="rounded-lg border-[1.5px] border-twine bg-twine-wash px-3 py-2 text-sm text-twine-deep">
              Refused: {refund.reason} {gen(refund.returnedAtto)} came back in the same transaction.
            </p>
          )}
          <p className="text-[14px] text-ink-3">
            Want the finder&apos;s side first? <Link href="/found" className="link">The demo shelf</Link>.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Hint({ problem, count, plain }: { problem: string; count?: string; plain: string }) {
  return (
    <div className="mt-1 flex flex-wrap justify-between gap-2 text-[13px]">
      <span className={problem ? "text-twine-deep" : "text-ink-3"}>{problem ? sentence(problem) : plain}</span>
      {count && <span className="mono text-ink-3">{count}</span>}
    </div>
  );
}
