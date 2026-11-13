"use client";

// One transaction while it goes through: the explorer link from the first second, the six stages (sent,
// propose, commit, reveal, accept, final) as a run of twine, and for a reveal the validators' votes.
// FINALIZED does not mean the state changed: a round whose validators split finalizes too, with nothing
// stored. The rail reads the tally, not only the status, and says so.

import * as React from "react";

import { IconExternal } from "@/components/icons";
import { useWallet } from "@/components/wallet";
import { failureOf, invalidateReads, isMock, movesMoney, txStatus, txUrl } from "@/lib/chain";
import { cx } from "@/lib/cx";
import { STAGES } from "@/lib/rpc";
import type { TxStatus, Votes } from "@/lib/types";

const POLL_MS = isMock ? 700 : 3000;

export const isFinal = (s: TxStatus) => s.undetermined || s.status === "FINALIZED" || s.status === "CANCELED" || s.status === "UNDETERMINED";

/** Polls txStatus(hash) until it is final. The status is kept with its hash, so a new hash never shows an old result. */
export function useTxStatus(hash: string | null): TxStatus | null {
  const [latest, setLatest] = React.useState<{ hash: string; status: TxStatus } | null>(null);
  React.useEffect(() => {
    if (!hash) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const s = await txStatus(hash);
        if (stopped) return;
        setLatest({ hash, status: s });
        if (isFinal(s)) return;
      } catch {
        /* a dropped poll is not a failed transaction; the next one may answer */
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [hash]);
  return latest && latest.hash === hash ? latest.status : null;
}

const STAGE_WORD: Record<string, string> = { PENDING: "Sent", PROPOSING: "Propose", COMMITTING: "Commit", REVEALING: "Reveal", ACCEPTED: "Accept", FINALIZED: "Final" };

/** Five (or more) validator places: agree, disagree, idle, or still waiting. */
export function VoteRow({ votes }: { votes: Votes }) {
  const total = votes.agree + votes.disagree + votes.idle;
  return (
    <div>
      <div className="flex gap-1.5" aria-label="Validator votes">
        {Array.from({ length: Math.max(5, total) }, (_, i) => {
          const kind = i < votes.agree ? "agree" : i < votes.agree + votes.disagree ? "disagree" : total ? "idle" : "waiting";
          return (
            <span
              key={i}
              title={kind}
              className={cx(
                "head h-7 min-w-0 flex-1 rounded-md border-[1.5px] text-center text-[11px] leading-[25px] font-bold uppercase",
                kind === "agree" && "border-green bg-green-wash text-green",
                kind === "disagree" && "border-twine bg-twine-wash text-twine-deep",
                kind === "idle" && "border-line-2 bg-room-2 text-ink-3",
                kind === "waiting" && "border-dashed border-line-2 bg-paper text-ink-3",
              )}
            >
              {kind === "waiting" ? "" : kind}
            </span>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-ink-3">{total === 0 ? "Waiting for the validators' votes…" : `${votes.agree} agree · ${votes.disagree} disagree · ${votes.idle} idle (did not vote this round)`}</p>
    </div>
  );
}

export function TxRail({ hash, label, judged, onDone, className }: { hash: string; label: string; judged?: boolean; onDone?: (status: TxStatus) => void; className?: string }) {
  const status = useTxStatus(hash);
  const wallet = useWallet();
  const doneFor = React.useRef<string | null>(null);
  const onDoneRef = React.useRef(onDone);
  const refreshRef = React.useRef(wallet.refreshBalance);
  const watchRef = React.useRef(wallet.watchBalance);
  React.useEffect(() => {
    onDoneRef.current = onDone;
    refreshRef.current = wallet.refreshBalance;
    watchRef.current = wallet.watchBalance;
  }, [onDone, wallet.refreshBalance, wallet.watchBalance]);

  React.useEffect(() => {
    if (!status || !isFinal(status) || doneFor.current === hash) return;
    doneFor.current = hash;
    // The cached views are stale the moment the chain moved: drop them before the page re-reads.
    invalidateReads();
    // A transfer lands a few seconds after FINALIZED: when this call moves GEN, the balance is re-read until it changes.
    if (movesMoney(status)) watchRef.current();
    else void refreshRef.current();
    onDoneRef.current?.(status);
  }, [status, hash]);

  const stageIndex = status ? STAGES.indexOf(status.status) : -1;
  const final = status ? isFinal(status) : false;
  const canceled = status?.status === "CANCELED";
  const split = !!status?.undetermined;
  const failure = status && final ? failureOf(status) : "";
  const ok = final && !failure;

  return (
    <div className={cx("sheet px-3.5 py-3 text-sm", className)} data-tx={hash}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="head min-w-0 font-bold">{label}</p>
        <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="mono link inline-flex items-center gap-1 text-xs break-all text-ink-2">
          {isMock ? "demo tx " : "explorer "}
          {hash.slice(0, 10)}…{hash.slice(-6)}
          <IconExternal size={12} />
        </a>
      </div>
      <ol className="mt-2.5 grid grid-cols-6 gap-1" aria-label="Consensus stages">
        {STAGES.map((stage, i) => {
          const reached = split ? i < 4 : final && !canceled ? true : i <= stageIndex;
          const current = !final && i === stageIndex;
          return (
            <li key={stage} aria-current={current ? "step" : undefined} className="min-w-0">
              <span aria-hidden="true" className={cx("block h-[5px] rounded-sm", reached ? (split || canceled ? "bg-ochre" : "bg-twine") : current ? "bg-kraft" : "bg-line")} />
              <span className={cx("head mt-1 block truncate text-[11px] font-bold uppercase", reached ? "text-ink-2" : current ? "text-ink" : "text-ink-3")}>{STAGE_WORD[stage]}</span>
            </li>
          );
        })}
      </ol>
      {judged && (
        <div className="mt-2.5">
          <VoteRow votes={status?.votes ?? { agree: 0, disagree: 0, idle: 0 }} />
        </div>
      )}
      <div className="mt-2" role="status" aria-live="polite">
        {!status && <p className="text-ink-2">Sent. Waiting for the network to list it…</p>}
        {status && !final && (
          <p className="text-ink-2">
            {status.status === "UNKNOWN"
              ? "The network has not listed this transaction yet. It usually appears within a few seconds."
              : judged
                ? "Every validator reads the marks and the description itself and asks its model four times; the contract stores a finding only if they agree on it exactly."
                : "The validators are checking the call. This usually takes under a minute; the page moves on by itself."}
          </p>
        )}
        {split && !canceled && (
          <p className="text-ochre">
            <strong>Nothing was stored.</strong> {failure}
          </p>
        )}
        {canceled && <p className="text-twine-deep">The network cancelled this transaction. Nothing was stored.</p>}
        {final && !split && !canceled && failure && (
          <p className="text-twine-deep">
            <strong>Final, and refused:</strong> {failure}
            {status?.result && "returned" in status.result ? " Everything sent came back in the same transaction." : ""}
          </p>
        )}
        {ok && !split && (
          <p className="text-green">
            <strong>Final.</strong> The validators agreed and the result is stored.
            {status && movesMoney(status) ? " Money moved by this call lands a few seconds after it is final." : ""}
          </p>
        )}
      </div>
    </div>
  );
}
