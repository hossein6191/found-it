"use client";

// Asking the demo bot to do one thing, and following what it signed: while the site's server asks, a
// short wait; if the bot says no, its reason in a sentence; once it signed, the demo's waiting panel over
// the rail of its transaction, the same rail every transaction on the site has.

import * as React from "react";

import { TxRail } from "@/components/tx-rail";
import { useTx, type TxRun } from "@/components/use-tx";
import { WaitPanel } from "@/components/wait-panel";
import { demoGuide, type DemoAct } from "@/lib/guide";
import type { Call, DemoAnswer, TxStatus } from "@/lib/types";

export type DemoCall = { tx: TxRun; asking: boolean; reason: string; act: DemoAct | null; ask: (act: DemoAct, fn: () => Promise<DemoAnswer>, call: Call) => Promise<boolean>; clear: () => void };

export function useDemoCall(onFinal?: (s: TxStatus, hash: string, call: Call) => void): DemoCall {
  const tx = useTx(onFinal);
  const [asking, setAsking] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [act, setAct] = React.useState<DemoAct | null>(null);
  const { track, reset } = tx;
  const ask = React.useCallback(
    async (a: DemoAct, fn: () => Promise<DemoAnswer>, call: Call) => {
      reset();
      setAct(a);
      setAsking(true);
      setReason("");
      const answer = await fn();
      setAsking(false);
      if (answer.ok) {
        track(answer.hash, call);
        return true;
      }
      setReason(answer.reason);
      return false;
    },
    [track, reset],
  );
  const clear = React.useCallback(() => {
    reset();
    setReason("");
    setAct(null);
  }, [reset]);
  return { tx, asking, reason, act, ask, clear };
}

export function DemoStage({ call, label, reward, mock, hideFinal }: { call: DemoCall; label: string; reward?: string; mock?: boolean; hideFinal?: boolean }) {
  if (call.asking) return <WaitPanel guide={demoGuide("asking")} />;
  if (call.reason)
    return (
      <p role="alert" className="rounded-lg border-[1.5px] border-ochre/60 bg-ochre-wash px-3 py-2 text-sm text-ochre">
        The demo bot did not act: {call.reason}
      </p>
    );
  if (!call.tx.hash || !call.act) return null;
  if (call.tx.final && hideFinal) return null;
  return (
    <div className="flex flex-col gap-2.5">
      {!call.tx.final && <WaitPanel guide={demoGuide(call.act, reward, mock)} since={call.tx.at || undefined} />}
      <TxRail hash={call.tx.hash} label={label} judged={call.act === "reveal"} onDone={call.tx.onDone} />
    </div>
  );
}
