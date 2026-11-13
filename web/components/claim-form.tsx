"use client";

// Describing an item to claim it: the description field with its suggestion chips and the contract's
// own limits as you type, the credit for the bond first when there is not enough, then claim(). Nothing
// is checked by a model here; the claim opens the owner's reveal window.

import * as React from "react";

import { Button } from "@/components/button";
import { CreditBox, useCredit } from "@/components/credit-box";
import { Suggest } from "@/components/suggest";
import { TxStage } from "@/components/tx-stage";
import { useTx } from "@/components/use-tx";
import { WalletGate } from "@/components/wallet-gate";
import { calls, isMock, madeClaim } from "@/lib/chain";
import { gen } from "@/lib/format";
import { sendingGuide, signGuide } from "@/lib/guide";
import { CLAIM_BOND, MAX_DESCRIPTION, descriptionProblem, pyLen, sentence } from "@/lib/rules";
import type { Item } from "@/lib/types";

export type DescriptionChip = { label: string; text: string; note?: string };

export function ClaimForm({ item, chips, onClaimed, intro }: { item: Item; chips: DescriptionChip[]; onClaimed?: (claim: string, hash: string) => void; intro?: React.ReactNode }) {
  const [text, setText] = React.useState("");
  const { credit } = useCredit();
  const tx = useTx((s, hash) => {
    const cid = madeClaim(s);
    if (cid) onClaimed?.(cid, hash);
  });
  const problem = text ? descriptionProblem(text) : "";
  const enough = credit !== null && credit >= CLAIM_BOND;
  const busy = tx.sending || (!!tx.hash && !tx.final);
  return (
    <div className="flex flex-col gap-4">
      {intro}
      <div>
        <label htmlFor={`desc-${item.id}`} className="label">
          Describe what only the holder would know
        </label>
        <p className="mt-0.5 text-[14px] text-ink-2">Name at least two of the hidden marks, specifically: the colour, the words, the name, the damage, the place. Say nothing you are not sure of: a wrong detail counts against you.</p>
        <textarea
          id={`desc-${item.id}`}
          className="field mt-2 min-h-[110px]"
          maxLength={MAX_DESCRIPTION}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="It has… and inside there is…"
          aria-describedby={`desc-help-${item.id}`}
        />
        <div id={`desc-help-${item.id}`} className="mt-1 flex flex-wrap justify-between gap-2 text-[13px]">
          <span className={problem ? "text-twine-deep" : "text-ink-3"}>{problem ? sentence(problem) : "English, printable characters, one line."}</span>
          <span className="mono text-ink-3">
            {pyLen(text)} / {MAX_DESCRIPTION}
          </span>
        </div>
        <Suggest label="Suggested descriptions" chips={chips.map((c) => ({ label: c.label, value: c.text, note: c.note }))} onPick={(v) => setText(v)} isOn={(v) => v === text} />
      </div>
      <WalletGate doing="claim this item">
        <div className="flex flex-col gap-3">
          {!enough && (
            <div className="rounded-lg border border-dashed border-line-2 bg-room-2/60 p-3">
              <p className="head mb-1 text-[14px] font-bold">First: hold {gen(CLAIM_BOND)} for the claim bond</p>
              <CreditBox compact />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={!enough || !text || !!problem || busy} onClick={() => void tx.start(calls.claim(item.id, text.trim()))}>
              Claim {item.id} for {gen(item.rewardAtto)}
            </Button>
            <span className="text-[13.5px] text-ink-2">Stakes {gen(CLAIM_BOND)} of your credit. No model runs yet.</span>
          </div>
          <TxStage tx={tx} sign={signGuide("claim")} sending={sendingGuide("claim", "0", isMock)} label={`Claiming ${item.id}`} />
        </div>
      </WalletGate>
    </div>
  );
}
