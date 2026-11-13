"use client";

// The whole shelf and the contract's books: every item, newest first, and every atto the contract holds
// (credit, rewards in escrow, bonds at stake) and has paid (rewards to finders, bonds to owners,
// rewards back), with its counts of every finding.

import Link from "next/link";

import { Parcel, PARCEL_WORD } from "@/components/parcel";
import { Placeholder, ReadError } from "@/components/read-state";
import { useAfterTx, useRead } from "@/components/use-read";
import { itemPath, readItemsWindow, readStats } from "@/lib/chain";
import { gen, when } from "@/lib/format";

export default function LedgerPage() {
  const stats = useRead(() => readStats(), []);
  const items = useRead(() => readItemsWindow(3), []);
  useAfterTx(stats.refresh);
  useAfterTx(items.refresh);
  const s = stats.data;
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-[34px] font-bold sm:text-[44px]">The ledger</h1>
        <p className="mt-2 text-[17px] text-ink-2">Everything on the shelf, and every atto the contract holds and has paid, as its own views report it.</p>
      </header>

      {stats.error && !s ? (
        <ReadError error={stats.error} retry={stats.retry} />
      ) : !s ? (
        <Placeholder lines={3} />
      ) : (
        <section aria-labelledby="books" className="grid gap-4 md:grid-cols-2">
          <div className="sheet px-4 py-4">
            <h2 id="books" className="text-[19px] font-bold">
              Held now
            </h2>
            <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-[15px]">
              <dt className="text-ink-2">Credit for claim bonds</dt>
              <dd className="mono text-right">{gen(s.creditsHeldAtto)}</dd>
              <dt className="text-ink-2">Rewards in escrow</dt>
              <dd className="mono text-right">{gen(s.rewardsHeldAtto)}</dd>
              <dt className="text-ink-2">Bonds at stake</dt>
              <dd className="mono text-right">{gen(s.bondsHeldAtto)}</dd>
              <dt className="head border-t border-line pt-1.5 font-bold">Owed in all</dt>
              <dd className="mono border-t border-line pt-1.5 text-right font-semibold">{gen(s.balanceOwedAtto)}</dd>
            </dl>
          </div>
          <div className="sheet px-4 py-4">
            <h2 className="text-[19px] font-bold">Paid out</h2>
            <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-[15px]">
              <dt className="text-ink-2">Rewards to finders</dt>
              <dd className="mono text-right">{gen(s.rewardsPaidAtto)}</dd>
              <dt className="text-ink-2">Bonds to owners</dt>
              <dd className="mono text-right">{gen(s.bondsToOwnersAtto)}</dd>
              <dt className="text-ink-2">Rewards back to owners</dt>
              <dd className="mono text-right">{gen(s.rewardsBackAtto)}</dd>
            </dl>
          </div>
          <div className="sheet px-4 py-4 md:col-span-2">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-center sm:grid-cols-4 lg:grid-cols-8">
              {(
                [
                  ["items", s.items],
                  ["returned", s.returned],
                  ["withdrawn", s.withdrawn],
                  ["claims", s.claims],
                  ["match", s.matched],
                  ["no match", s.noMatch],
                  ["unclear", s.unclear],
                  ["by default", s.defaulted],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="head text-[12px] font-bold tracking-wide text-ink-3 uppercase">{k}</dt>
                  <dd className="stencil text-[26px]">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[13.5px] text-ink-3">
              {s.reseals} reseal{s.reseals === 1 ? "" : "s"} · {s.refunds} refused call{s.refunds === 1 ? "" : "s"} with everything returned
            </p>
          </div>
        </section>
      )}

      <section aria-labelledby="all">
        <h2 id="all" className="mb-3 text-[24px] font-bold">
          Every item
        </h2>
        {items.error && !items.data ? (
          <ReadError error={items.error} retry={items.retry} />
        ) : !items.data ? (
          <Placeholder lines={4} />
        ) : items.data.rows.length === 0 ? (
          <p className="text-ink-2">
            Nothing posted yet. <Link href="/lost" className="link">Post the first lost item</Link>.
          </p>
        ) : (
          <div className="shelf">
            <ul className="shelf-bay grid grid-cols-2 gap-x-3 gap-y-4 pb-2 sm:grid-cols-3 lg:grid-cols-5">
              {items.data.rows.map((x) => (
                <li key={x.id} className="min-w-0">
                  <Link href={itemPath(x.id)} className="flex flex-col items-center gap-1 rounded-lg px-1 pt-1 pb-1.5 text-center hover:bg-paper/60">
                    <Parcel id={x.id} status={x.status} size={150} title={x.title} />
                    <span className="head line-clamp-2 text-[14px] leading-tight font-bold">{x.title}</span>
                    <span className="text-[12.5px] text-ink-2">
                      {gen(x.rewardAtto)} · {PARCEL_WORD[x.status]}
                    </span>
                    <span className="text-[12px] text-ink-3">closes {when(x.claimBy)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="plank" />
          </div>
        )}
        {items.data?.partial && <p className="mt-2 text-[13.5px] text-ink-3">The newest pages of {items.data.total} items.</p>}
      </section>
    </div>
  );
}
