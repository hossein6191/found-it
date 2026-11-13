"use client";

// The finder's credit for claim bonds: what this address holds on the contract, a deposit with one-click
// amounts, and taking it all back. A claim stakes its 0.02 GEN bond from here, so claim() carries no value.

import * as React from "react";

import { Button } from "@/components/button";
import { Suggest } from "@/components/suggest";
import { TxStage } from "@/components/tx-stage";
import { useMe } from "@/components/use-me";
import { useAfterTx, useRead } from "@/components/use-read";
import { useTx } from "@/components/use-tx";
import { calls, isMock, readCredit } from "@/lib/chain";
import { gen } from "@/lib/format";
import { sendingGuide, signGuide } from "@/lib/guide";
import { CLAIM_BOND } from "@/lib/rules";
import { DEPOSIT_CHIPS } from "@/lib/suggestions";

export function useCredit(): { credit: bigint | null; refresh: () => Promise<void> } {
  const me = useMe();
  const r = useRead(async () => {
    const c = await readCredit(me.address);
    return { data: BigInt(c.data), source: c.source };
  }, [me.address], { enabled: !!me.address });
  useAfterTx(r.refresh);
  return { credit: r.data, refresh: r.refresh };
}

export function CreditBox({ compact, onReady }: { compact?: boolean; onReady?: () => void }) {
  const { credit } = useCredit();
  const [amount, setAmount] = React.useState<bigint>(CLAIM_BOND * 2n);
  const dep = useTx();
  const out = useTx();
  const enough = credit !== null && credit >= CLAIM_BOND;
  React.useEffect(() => {
    if (enough) onReady?.();
  }, [enough, onReady]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[15px]">
          Your credit for claim bonds: <strong className="mono">{credit === null ? "…" : gen(credit)}</strong>
          {credit !== null && <span className="text-ink-3"> ({enough ? `enough for ${Number(credit / CLAIM_BOND)} claim${credit / CLAIM_BOND === 1n ? "" : "s"}` : `a claim stakes ${gen(CLAIM_BOND)}`})</span>}
        </p>
        {!compact && credit !== null && credit > 0n && (
          <Button size="sm" variant="paper" disabled={out.sending || (!!out.hash && !out.final)} onClick={() => void out.start(calls.withdraw(credit))}>
            Take it all back
          </Button>
        )}
      </div>
      {(!compact || !enough) && (
        <div>
          <p className="text-[14px] text-ink-2">Deposit credit first: it stays yours, and you can take back whatever is not staked at any time.</p>
          <Suggest label="Deposit amounts" chips={DEPOSIT_CHIPS} onPick={setAmount} isOn={(v) => v === amount} />
          <Button className="mt-2.5" variant="kraft" disabled={dep.sending || (!!dep.hash && !dep.final)} onClick={() => void dep.start(calls.deposit(amount))}>
            Deposit {gen(amount)}
          </Button>
        </div>
      )}
      <TxStage tx={dep} sign={signGuide("deposit", amount.toString())} sending={sendingGuide("deposit", amount.toString(), isMock)} label={`Depositing ${gen(amount)} of credit`} />
      <TxStage tx={out} sign={signGuide("withdraw")} sending={sendingGuide("withdraw", credit?.toString() ?? "0", isMock)} label="Taking your credit back" />
    </div>
  );
}
