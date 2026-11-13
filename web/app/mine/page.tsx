"use client";

// Everything of yours: the items you lost and the items you claimed, each with what it waits for; your
// credit for claim bonds, to deposit or take back; and the seals this browser keeps, to copy.

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/button";
import { CreditBox } from "@/components/credit-box";
import { IconCopy } from "@/components/icons";
import { Parcel, PARCEL_WORD } from "@/components/parcel";
import { Placeholder, ReadError } from "@/components/read-state";
import { useLocal } from "@/components/use-local";
import { useMe } from "@/components/use-me";
import { useAfterTx, useRead } from "@/components/use-read";
import { WalletGate } from "@/components/wallet-gate";
import { itemPath, readItemsOfWindow } from "@/lib/chain";
import { gen, shortHex, when } from "@/lib/format";
import { parseSeals, sealsRaw } from "@/lib/local-seals";
import type { MyRow } from "@/lib/types";

export default function MinePage() {
  const me = useMe();
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-[34px] font-bold sm:text-[44px]">Mine</h1>
        <p className="mt-2 text-[17px] text-ink-2">What you lost, what you found, and what you hold here.</p>
      </header>
      <WalletGate doing="see your items">{me.address && <MineFor address={me.address} />}</WalletGate>
      <KeptSeals />
    </div>
  );
}

function MineFor({ address }: { address: string }) {
  const r = useRead(() => readItemsOfWindow(address), [address]);
  useAfterTx(r.refresh);
  const rows = r.data?.rows ?? [];
  const lost = rows.filter((x) => x.role === "owner");
  const found = rows.filter((x) => x.role === "finder");
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        {r.error && !r.data ? (
          <ReadError error={r.error} retry={r.retry} />
        ) : !r.data ? (
          <Placeholder lines={4} />
        ) : (
          <>
            <Rows title="You lost" rows={lost} empty={<>Nothing posted from this address. <Link href="/lost" className="link">Post a lost item</Link>.</>} />
            <Rows title="You claimed" rows={found} empty={<>No claims from this address. <Link href="/found" className="link">Try the demo shelf</Link>.</>} />
            {r.data.partial && <p className="text-[13.5px] text-ink-3">Showing the newest {rows.length} of {r.data.total}.</p>}
          </>
        )}
      </div>
      <section aria-labelledby="credit" className="sheet h-fit px-4 py-4">
        <h2 id="credit" className="mb-2 text-[20px] font-bold">
          Credit for claim bonds
        </h2>
        <CreditBox />
      </section>
    </div>
  );
}

function Rows({ title, rows, empty }: { title: string; rows: MyRow[]; empty: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[22px] font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-[15px] text-ink-2">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((x) => (
            <li key={x.id}>
              <Link href={itemPath(x.id)} className="sheet flex items-center gap-3 px-3 py-2 hover:border-kraft-2">
                <Parcel id={x.id} status={x.status} size={78} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="head block truncate font-bold">{x.title}</span>
                  <span className="block text-[13.5px] text-ink-2">
                    {x.id} · {PARCEL_WORD[x.status]} · {x.claims} claim{x.claims === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="mono shrink-0 text-[13px]">{gen(x.rewardAtto)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function KeptSeals() {
  const raw = useLocal(sealsRaw, "");
  const seals = React.useMemo(() => parseSeals(raw), [raw]);
  const [copied, setCopied] = React.useState("");
  if (!seals.length) return null;
  return (
    <section aria-labelledby="kept" className="sheet px-4 py-4">
      <h2 id="kept" className="text-[20px] font-bold">
        Seals kept in this browser
      </h2>
      <p className="mt-1 text-[14.5px] text-ink-2">Only here: the contract holds the digests and nothing else. Copy each one somewhere you keep.</p>
      <ul className="mt-3 flex flex-col gap-3">
        {seals.map((s) => (
          <li key={s.digest} className="rounded-lg border border-line bg-room-2/50 p-3 text-[14px]">
            <p className="head font-bold">
              {s.title || "Untitled"} {s.item && <Link href={itemPath(s.item)} className="link ml-1">{s.item}</Link>}
            </p>
            <p className="mt-1 text-ink-2">{s.marks}</p>
            <p className="mono mt-1 break-all text-ink-3">
              salt {s.salt} · seal {shortHex(s.digest)} · {when(s.savedAt)}
            </p>
            <Button
              size="sm"
              variant="paper"
              className="mt-2"
              icon={<IconCopy />}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`hidden marks: ${s.marks}\nsalt: ${s.salt}\ndigest: ${s.digest}`);
                  setCopied(s.digest);
                } catch {
                  /* blocked: the lines are on screen */
                }
              }}
            >
              {copied === s.digest ? "Copied" : "Copy"}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
