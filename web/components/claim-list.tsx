// Every claim on an item, newest first: who claimed, what they wrote, and, once settled, the finding,
// where the bond and the reward went, and the marks it was judged against.

import { Addr } from "@/components/addr";
import { marksLines } from "@/components/note";
import { ResultSlip } from "@/components/slip";
import { gen, when } from "@/lib/format";
import type { Claim } from "@/lib/types";

const WORD: Record<string, string> = { match: "match", no_match: "no match", unclear: "unclear", default: "paid by default", "": "pending" };

export function ClaimList({ claims, me, owner }: { claims: Claim[]; me: string; owner: string }) {
  if (!claims.length) return <p className="text-[15px] text-ink-2">No claims yet.</p>;
  return (
    <ol className="flex flex-col gap-4">
      {claims.map((c, i) => {
        const role = me && c.finder === me ? "finder" : me && owner === me ? "owner" : "visitor";
        return (
          <li key={c.id} className="flex flex-col gap-2.5">
            {i === 0 && c.status === "settled" && c.finding ? (
              <ResultSlip finding={c.finding} rewardAtto={c.rewardAtto} bondAtto={c.bondAtto} why={c.why} claim={c.id} item={c.item} youAre={role} />
            ) : null}
            <div className="sheet px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="head text-[15px] font-bold">
                  {c.id} <span className="font-semibold text-ink-3">· claim {c.number}</span>
                </p>
                <p className="head text-[13px] font-bold tracking-wide uppercase" style={{ color: c.finding === "match" || c.finding === "default" ? "var(--color-green)" : c.finding === "no_match" ? "var(--color-twine)" : c.finding === "unclear" ? "var(--color-ochre)" : "var(--color-ink-3)" }}>
                  {WORD[c.finding] ?? c.finding}
                </p>
              </div>
              <p className="mt-1 text-[13.5px] text-ink-3">
                by <Addr address={c.finder} me={me} /> at {when(c.at)}
                {c.status === "settled" ? `, settled ${when(c.settledAt)}` : `, reveal window until ${when(c.revealBy)}`}
              </p>
              <p className="mt-2 text-[15px]">&ldquo;{c.description}&rdquo;</p>
              {c.status === "settled" && (
                <p className="mt-2 text-[13.5px] text-ink-2">
                  {c.finding === "match" || c.finding === "default" ? `Reward ${gen(c.rewardAtto)} to the finder; bond back to the finder's credit.` : c.bondTo === "owner" ? `Bond ${gen(c.bondAtto)} to the owner.` : `Bond ${gen(c.bondAtto)} back to the finder's credit.`}
                </p>
              )}
              {c.marks && (
                <details className="mt-2 text-[13.5px]">
                  <summary className="head cursor-pointer font-bold text-ink-2">The marks it was judged against</summary>
                  <ol className="mt-1.5 list-decimal pl-5 text-ink-2">
                    {marksLines(c.marks).map((m, k) => (
                      <li key={k}>{m}</li>
                    ))}
                  </ol>
                </details>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
