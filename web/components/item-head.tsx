// The top of an item: its parcel on a short stretch of shelf, the title, what anyone may know, the
// reward, and the facts of its seal and its windows.

import { Addr } from "@/components/addr";
import { Parcel, PARCEL_WORD } from "@/components/parcel";
import { gen, shortHex, span, when } from "@/lib/format";
import type { Item } from "@/lib/types";

export function ItemHead({ item, me }: { item: Item; me: string }) {
  return (
    <div className="grid gap-5 md:grid-cols-[260px_minmax(0,1fr)] md:items-end">
      <div className="shelf">
        <div className="shelf-bay flex justify-center">
          <Parcel id={item.id} status={item.status} size={220} title={item.title} />
        </div>
        <div className="plank" />
      </div>
      <div className="min-w-0">
        <p className="head text-[13px] font-bold tracking-[0.14em] text-ink-3 uppercase">
          Shelf {item.id} · {PARCEL_WORD[item.status]}
        </p>
        <h1 className="mt-1 text-[30px] font-bold sm:text-[38px]">{item.title}</h1>
        <p className="mt-2 text-[17px] text-ink-2">{item.publicDescription}</p>
        <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[14.5px]">
          <dt className="text-ink-3">Reward</dt>
          <dd className="mono font-semibold">{gen(item.rewardAtto)}</dd>
          <dt className="text-ink-3">Claim bond</dt>
          <dd className="mono">{gen(item.claimBondAtto)}</dd>
          <dt className="text-ink-3">Owner</dt>
          <dd>
            <Addr address={item.owner} me={me} />
          </dd>
          <dt className="text-ink-3">Claims close</dt>
          <dd>{when(item.claimBy)}</dd>
          <dt className="text-ink-3">Reveal window</dt>
          <dd>{span(item.revealSeconds)} after each claim</dd>
          <dt className="text-ink-3">Seal</dt>
          <dd className="mono min-w-0 break-all">
            {shortHex(item.marksDigest, 14, 8)} <span className="text-ink-3">(seal {item.seals})</span>
          </dd>
        </dl>
      </div>
    </div>
  );
}
