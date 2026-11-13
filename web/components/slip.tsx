// The printed result slip a judged or defaulted claim ends with: one line in capitals saying what
// happened to the money, then the amounts, the contract's own reason, and the claim it belongs to.

import { gen } from "@/lib/format";
import type { Finding } from "@/lib/rules";

export const SLIP_HEAD: Record<Exclude<Finding, "">, string> = {
  match: "MATCH - REWARD PAID",
  no_match: "NO MATCH - BOND TO THE OWNER",
  unclear: "UNCLEAR - BOND BACK",
  default: "NOT ANSWERED - REWARD PAID",
};

const COLOUR: Record<Exclude<Finding, "">, string> = {
  match: "var(--color-green)",
  default: "var(--color-green)",
  no_match: "var(--color-twine)",
  unclear: "var(--color-ochre)",
};

export function ResultSlip({ finding, rewardAtto, bondAtto, why, claim, item, youAre }: { finding: Exclude<Finding, "">; rewardAtto: string; bondAtto: string; why: string; claim: string; item: string; youAre?: "owner" | "finder" | "visitor" }) {
  const paid = finding === "match" || finding === "default";
  const rows: [string, string][] = paid
    ? [
        ["Reward to the finder", gen(rewardAtto)],
        ["Bond back to the finder's credit", gen(bondAtto)],
      ]
    : finding === "no_match"
      ? [
          ["Bond to the owner", gen(bondAtto)],
          ["Reward", "stays in escrow"],
        ]
      : [
          ["Bond back to the finder's credit", gen(bondAtto)],
          ["Reward", "stays in escrow"],
        ];
  return (
    <article className="slip rise px-4 pt-4 pb-4 sm:px-6" style={{ ["--slip" as string]: COLOUR[finding] }} data-slip={finding}>
      <p className="head text-[11.5px] font-bold tracking-[0.16em] text-ink-3 uppercase">
        Claim {claim} on {item}
        {youAre && youAre !== "visitor" ? ` · you are the ${youAre}` : ""}
      </p>
      <h3 className="head mt-1.5 text-[24px] leading-tight font-bold tracking-tight sm:text-[28px]" style={{ color: COLOUR[finding] }}>
        {SLIP_HEAD[finding]}
      </h3>
      <dl className="slip-rule mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 pt-3 text-[15px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-2">{k}</dt>
            <dd className="mono text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {why && <p className="slip-rule mt-3 pt-3 text-[14px] leading-relaxed text-ink-2">The contract: &ldquo;{why}.&rdquo;</p>}
    </article>
  );
}
