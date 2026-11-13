"use client";

// What can be done to an item right now, by whoever is looking: the owner reveals for a pending claim
// (with the marks and salt this browser kept, or pasted back in), seals new marks on an exposed item, or
// takes the reward back once claims closed; anyone defaults a claim whose reveal window passed; the owner
// of a visitor's item can have the demo finder claim it with one of three fixed lines; and on the demo
// owner's items, the demo owner reveals, reseals or reposts when asked.

import * as React from "react";

import { Button } from "@/components/button";
import { DemoStage, useDemoCall } from "@/components/demo-call";
import { FoldedNote } from "@/components/note";
import { SealEditor, useSealDraft } from "@/components/seal-editor";
import { TxStage } from "@/components/tx-stage";
import { useLocal } from "@/components/use-local";
import { useTx } from "@/components/use-tx";
import { WalletGate } from "@/components/wallet-gate";
import { calls, isMock, requestDemoClaim, requestDemoRepost, requestDemoReseal, requestDemoReveal } from "@/lib/chain";
import { FINDER_LINES } from "@/lib/demo-items";
import { gen, shortHex } from "@/lib/format";
import { sendingGuide, signGuide } from "@/lib/guide";
import { parseSeals, saveSeal, sealsRaw } from "@/lib/local-seals";
import { isSalt, marksProblem, sentence } from "@/lib/rules";
import { sealOf } from "@/lib/seal";
import { rememberTx } from "@/lib/tx-memory";
import type { Item, TxStatus } from "@/lib/types";

const remember = (item: string, label: string) => (_s: TxStatus, hash: string) => rememberTx(item, hash, label);

/** The owner reveals the hidden marks and the salt, and the validators judge the pending claim in the same call. */
export function RevealBox({ item }: { item: Item }) {
  const raw = useLocal(sealsRaw, "");
  const kept = React.useMemo(() => parseSeals(raw).find((s) => s.digest === item.marksDigest) ?? null, [raw, item.marksDigest]);
  const [marks, setMarks] = React.useState("");
  const [salt, setSalt] = React.useState("");
  const tx = useTx(remember(item.id, "reveal"));
  const useMarks = kept ? kept.marks : marks;
  const useSalt = kept ? kept.salt : salt.trim();
  const problem = !kept && marks ? marksProblem(marks) || (salt && !isSalt(salt.trim()) ? "the salt is 16 to 64 ASCII letters and digits" : "") : "";
  const opens = !!useMarks && isSalt(useSalt) && sealOf(useMarks, useSalt) === item.marksDigest;
  const busy = tx.sending || (!!tx.hash && !tx.final);
  return (
    <div className="flex flex-col gap-3">
      {kept ? (
        <FoldedNote marks={kept.marks} sealed={false} heading="Your hidden marks, kept in this browser" footer={<span>They open this item&apos;s seal: the digest matches.</span>} />
      ) : (
        <div className="flex flex-col gap-2.5">
          <p className="text-[14.5px] text-ink-2">This browser does not hold the marks for this seal. Paste them back exactly as you sealed them, with the salt.</p>
          <label className="label" htmlFor={`rv-marks-${item.id}`}>
            Hidden marks
          </label>
          <textarea id={`rv-marks-${item.id}`} className="field min-h-[80px]" value={marks} onChange={(e) => setMarks(e.target.value)} />
          <label className="label" htmlFor={`rv-salt-${item.id}`}>
            Salt
          </label>
          <input id={`rv-salt-${item.id}`} className="field mono" value={salt} onChange={(e) => setSalt(e.target.value)} autoComplete="off" spellCheck={false} />
          <p className={`text-[13px] ${opens ? "text-green" : problem ? "text-twine-deep" : "text-ink-3"}`}>
            {opens ? "These open the seal: the digest matches." : problem ? sentence(problem) : marks && salt ? "These do not open the seal: the digest does not match." : `The seal is ${shortHex(item.marksDigest)}.`}
          </p>
        </div>
      )}
      <WalletGate doing="reveal your marks">
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={!opens || busy} onClick={() => void tx.start(calls.reveal(item.id, useMarks, useSalt))}>
            Reveal and have it judged
          </Button>
          <span className="text-[13.5px] text-ink-2">The validators judge the claim in this same transaction.</span>
        </div>
      </WalletGate>
      <TxStage tx={tx} sign={signGuide("reveal")} sending={sendingGuide("reveal", "0", isMock)} label={`Revealing the marks of ${item.id}`} judged />
    </div>
  );
}

/** The owner seals new marks on an item a judged claim left exposed. */
export function ResealBox({ item }: { item: Item }) {
  const draft = useSealDraft();
  const tx = useTx(remember(item.id, "reseal"));
  const busy = tx.sending || (!!tx.hash && !tx.final);
  const send = () => {
    if (!draft.digest) return;
    saveSeal({ digest: draft.digest, marks: draft.marks.trim(), salt: draft.salt, title: item.title, item: item.id });
    void tx.start(calls.reseal(item.id, draft.digest));
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14.5px] text-ink-2">The last marks are public now. Seal new ones nobody has seen: a digest this item sealed before is refused, and marks that were revealed prove nothing however you salt them.</p>
      <SealEditor draft={draft} id={`reseal-${item.id}`} title={item.title} />
      <WalletGate doing="seal new marks">
        <Button disabled={!draft.digest || busy} onClick={send}>
          Seal the new marks
        </Button>
      </WalletGate>
      <TxStage tx={tx} sign={signGuide("reseal")} sending={sendingGuide("reseal", "0", isMock)} label={`Sealing new marks on ${item.id}`} />
    </div>
  );
}

export function WithdrawRewardBox({ item }: { item: Item }) {
  const tx = useTx(remember(item.id, "withdraw_reward"));
  const busy = tx.sending || (!!tx.hash && !tx.final);
  return (
    <div className="flex flex-col gap-3">
      <WalletGate doing="take the reward back">
        <Button variant="green" disabled={busy} onClick={() => void tx.start(calls.withdrawReward(item.id))}>
          Take the {gen(item.rewardAtto)} reward back
        </Button>
      </WalletGate>
      <TxStage tx={tx} sign={signGuide("withdraw_reward")} sending={sendingGuide("withdraw_reward", item.rewardAtto, isMock)} label={`Taking the reward of ${item.id} back`} />
    </div>
  );
}

export function DefaultBox({ item, mine }: { item: Item; mine: boolean }) {
  const tx = useTx(remember(item.id, "default"));
  const busy = tx.sending || (!!tx.hash && !tx.final);
  return (
    <div className="flex flex-col gap-3">
      <WalletGate doing="default the claim">
        <Button variant={mine ? "green" : "kraft"} disabled={busy} onClick={() => void tx.start(calls.default(item.id))}>
          {mine ? `Default it: be paid ${gen(item.rewardAtto)}` : "Default the claim for its finder"}
        </Button>
      </WalletGate>
      <TxStage tx={tx} sign={signGuide("default")} sending={sendingGuide("default", item.rewardAtto, isMock)} label={`Defaulting the claim on ${item.id}`} />
    </div>
  );
}

/** On a visitor's own open item: the demo finder claims it with one of three fixed lines. */
export function DemoFinderBox({ item, online, why }: { item: Item; online: boolean; why: string }) {
  const call = useDemoCall(remember(item.id, "demo finder claim"));
  const busy = call.asking || (!!call.tx.hash && !call.tx.final);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14.5px] text-ink-2">
        Play the owner: have the demo finder claim your item with one of its three fixed lines. Its accurate line names two of the first suggested marks; on any other marks every line is simply a description the
        validators read for what it says. Nothing you type is sent through the bot.
      </p>
      {!online && <p className="text-[14px] text-ochre">The demo finder is away: {why}.</p>}
      <ul className="flex flex-col gap-2">
        {FINDER_LINES.map((l) => (
          <li key={l.key} className="flex flex-col gap-2 rounded-lg border border-line bg-paper p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 text-[14.5px]">
              <span className="head mr-1 font-bold">{l.label}.</span>
              <span className="text-ink-2">&ldquo;{l.text}&rdquo;</span>
            </p>
            <Button size="sm" variant="kraft" className="shrink-0" disabled={!online || busy} onClick={() => void call.ask("claim", () => requestDemoClaim(item.id, l.key), calls.claim(item.id, l.text))}>
              Have it claim
            </Button>
          </li>
        ))}
      </ul>
      <DemoStage call={call} label={`The demo finder claims ${item.id}`} mock={isMock} />
    </div>
  );
}

/** On the demo owner's items: the three things the demo owner does when asked. */
export function DemoOwnerBox({ item, online, why, canReveal }: { item: Item; online: boolean; why: string; canReveal: boolean }) {
  const call = useDemoCall(remember(item.id, "demo owner"));
  const busy = call.asking || (!!call.tx.hash && !call.tx.final);
  const reveal = item.status === "claimed" && !item.defaultable && canReveal;
  const reseal = item.status === "exposed" && item.resealable;
  const repost = item.status === "returned" || item.status === "withdrawn";
  if (!reveal && !reseal && !repost && !call.tx.hash && !call.reason) return null;
  return (
    <div className="flex flex-col gap-3">
      {!online && <p className="text-[14px] text-ochre">The demo owner is away: {why}.</p>}
      <div className="flex flex-wrap gap-2">
        {reveal && (
          <Button disabled={!online || busy} onClick={() => void call.ask("reveal", () => requestDemoReveal(item.id), calls.reveal(item.id, "", ""))}>
            Ask the demo owner to reveal
          </Button>
        )}
        {reseal && (
          <Button variant="kraft" disabled={!online || busy} onClick={() => void call.ask("reseal", () => requestDemoReseal(item.id), calls.reseal(item.id, ""))}>
            Ask the demo owner to seal new marks
          </Button>
        )}
        {repost && (
          <Button variant="kraft" disabled={!online || busy} onClick={() => void call.ask("repost", () => requestDemoRepost(item.id), calls.postLost("", "", "", 0, 0, BigInt(item.rewardAtto)))}>
            Put it back on the shelf
          </Button>
        )}
      </div>
      <DemoStage call={call} label={call.act === "reveal" ? `The demo owner reveals ${item.id}` : call.act === "reseal" ? `The demo owner reseals ${item.id}` : "The demo owner posts the item again"} reward={item.rewardAtto} mock={isMock} />
    </div>
  );
}
