"use client";

// How it works, in the contract's own words: the four questions word for word and how their answers
// combine, why this needs GenLayer, where the money goes, the limits, and the whole rules() answer read
// live from the contract.

import * as React from "react";

import { Placeholder, ReadError } from "@/components/read-state";
import { useRead } from "@/components/use-read";
import { readRules } from "@/lib/chain";
import { gen } from "@/lib/format";
import { CLAIM_BOND, MAX_REWARD, MIN_REWARD, QUESTION_FEWER, QUESTION_NAMES_TWO, QUESTION_NOTHING_WRONG, QUESTION_SOMETHING_WRONG, SCOPE } from "@/lib/rules";

type Q = Record<string, Record<string, string>>;

const MONEY: [string, string, string, string][] = [
  ["deposit", "anyone", "the contract, as their credit", "what they send"],
  ["post_lost", "the owner", "the item's escrow", `the reward, ${gen(MIN_REWARD)} to ${gen(MAX_REWARD)}`],
  ["claim", "the finder's credit", "the claim's bond", gen(CLAIM_BOND)],
  ["reveal, match", "the escrow", "the finder", "the reward; the bond back to the finder's credit"],
  ["reveal, no_match", "the bond", "the owner", gen(CLAIM_BOND)],
  ["reveal, unclear", "the bond", "the finder's credit", gen(CLAIM_BOND)],
  ["default", "the escrow", "the finder", "the reward; the bond back to the finder's credit"],
  ["withdraw_reward", "the escrow", "the owner", "the reward"],
  ["withdraw", "the contract", "the depositor", "any part of their credit"],
  ["a refused deposit or post_lost", "the contract", "the sender", "everything sent"],
];

export default function HowPage() {
  const r = useRead(() => readRules(), []);
  const rules = r.data;
  const questions = (rules?.questions ?? null) as Q | null;
  const limits = Array.isArray(rules?.limits) ? (rules.limits as string[]) : null;
  return (
    <div className="flex flex-col gap-10">
      <header className="max-w-[46rem]">
        <h1 className="text-[34px] font-bold sm:text-[44px]">How it works</h1>
        <p className="mt-3 text-[17px] text-ink-2">
          One consensus round decides each claim, inside the owner&apos;s reveal() call. The model is asked two framings, each in both orders: four askings, two plain questions each. The contract combines the
          answers; no model decides alone, and no model ever sees an amount, an address, the title or an id.
        </p>
      </header>

      <section aria-labelledby="q" className="grid gap-4 md:grid-cols-2">
        <h2 id="q" className="text-[24px] font-bold md:col-span-2">
          The questions, word for word
        </h2>
        {(
          [
            ["MATCHES", "matches", [["names_two", QUESTION_NAMES_TWO], ["nothing_wrong", QUESTION_NOTHING_WRONG]]],
            ["GUESS", "guess", [["fewer_than_two", QUESTION_FEWER], ["something_wrong", QUESTION_SOMETHING_WRONG]]],
          ] as const
        ).map(([name, key, qs]) => (
          <div key={name} className="sheet px-4 py-4">
            <h3 className="head text-[17px] font-bold tracking-wide">{name}</h3>
            <ol className="mt-2 flex flex-col gap-2 text-[15.5px]">
              {qs.map(([k, fallback]) => (
                <li key={k}>
                  <span className="mono mr-1.5 text-ink-3">{k}</span>
                  <q>{questions?.[key]?.[k] ?? fallback}</q>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[13.5px] text-ink-3">Asked with the HIDDEN_MARKS block first, and again with the FINDER_DESCRIPTION block first.</p>
          </div>
        ))}
        <div className="sheet px-4 py-4 md:col-span-2">
          <h3 className="head text-[17px] font-bold">What counts as naming a mark</h3>
          <p className="mt-1.5 text-[15.5px] text-ink-2">{SCOPE}</p>
          <h3 className="head mt-4 text-[17px] font-bold">How the answers combine</h3>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-[15px] text-ink-2">
            <li>&ldquo;Names two marks&rdquo; holds when names_two is yes in both orders and fewer_than_two is no in both; it fails on the exact reverse.</li>
            <li>&ldquo;Contradicts none&rdquo; holds when nothing_wrong is yes in both orders and something_wrong is no in both; it fails on the exact reverse.</li>
            <li>
              <strong className="text-green">match</strong> only when both hold; <strong className="text-twine-deep">no_match</strong> when either fails; <strong className="text-ochre">unclear</strong> otherwise, an unreadable answer
              included. A reader led by block order, or one that says yes or no to everything, lands on unclear, which moves no reward.
            </li>
            <li>Every validator reruns all four askings and agrees only when its own finding equals the leader&apos;s exactly.</li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="why" className="sheet px-5 py-5">
        <h2 id="why" className="text-[24px] font-bold">
          Why GenLayer
        </h2>
        <p className="mt-2 text-[16px] text-ink-2">
          Whether &ldquo;a red tag that says TIDEPOOL&rdquo; names &ldquo;a red luggage tag reading TIDEPOOL&rdquo;, whether &ldquo;a library card for Ines Corrie&rdquo; contradicts &ldquo;a library card for Mara Quist&rdquo;, and whether
          &ldquo;a blue bag with some stuff inside&rdquo; names anything at all, are judgements about meaning. A string match cannot tell a paraphrase from a miss, and a single model call is one reading that whoever runs it
          controls: here the owner, who keeps the reward and every bond when the answer is no. On GenLayer every validator reads the claim for itself, and only a finding they agree on moves money. The owner cannot
          even decline to ask: a claim left unanswered is paid.
        </p>
      </section>

      <section aria-labelledby="money">
        <h2 id="money" className="mb-3 text-[24px] font-bold">
          Where the money goes
        </h2>
        <div className="sheet overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-[14.5px]">
            <thead className="bg-room-2">
              <tr>
                {["Moment", "From", "To", "Amount"].map((h) => (
                  <th key={h} scope="col" className="head px-3 py-2 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MONEY.map((m) => (
                <tr key={m[0]} className="border-t border-line align-top">
                  <th scope="row" className="mono px-3 py-2 font-normal">
                    {m[0]}
                  </th>
                  <td className="px-3 py-2 text-ink-2">{m[1]}</td>
                  <td className="px-3 py-2 text-ink-2">{m[2]}</td>
                  <td className="px-3 py-2 text-ink-2">{m[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="limits">
        <h2 id="limits" className="mb-3 text-[24px] font-bold">
          The limits, from the contract
        </h2>
        {r.error && !rules ? (
          <ReadError error={r.error} retry={r.retry} />
        ) : !limits ? (
          <Placeholder lines={4} />
        ) : (
          <ul className="flex flex-col gap-2">
            {limits.map((l) => (
              <li key={l} className="sheet px-4 py-2.5 text-[15px] text-ink-2">
                {l[0].toUpperCase() + l.slice(1)}.
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="rules">
        <h2 id="rules" className="mb-3 text-[24px] font-bold">
          rules(), read live
        </h2>
        {rules ? (
          <details className="sheet px-4 py-3">
            <summary className="head cursor-pointer font-bold">The contract&apos;s whole answer, as it returned it</summary>
            <pre className="mono mt-3 max-h-[32rem] overflow-auto text-[12.5px] leading-relaxed break-words whitespace-pre-wrap text-ink-2">{JSON.stringify(rules, null, 2)}</pre>
          </details>
        ) : r.error ? null : (
          <Placeholder lines={2} />
        )}
      </section>
    </div>
  );
}
