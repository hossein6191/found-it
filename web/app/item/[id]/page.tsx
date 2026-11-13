"use client";

// One item, for anyone: what anyone may know, the folded note of its marks (sealed until a judged claim
// reveals them), one waiting panel that says what is happening, how long, whether you must act, whether
// you can leave and where the money is, the actions open to you right now (claim it, reveal, reseal,
// take the reward back, default a claim the owner let pass, have the demo finder claim your own item),
// and every claim with its finding.

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { ClaimForm } from "@/components/claim-form";
import { ClaimList } from "@/components/claim-list";
import { DefaultBox, DemoFinderBox, DemoOwnerBox, ResealBox, RevealBox, WithdrawRewardBox } from "@/components/item-actions";
import { ItemHead } from "@/components/item-head";
import { FoldedNote } from "@/components/note";
import { Placeholder, ReadError } from "@/components/read-state";
import { useDemoStatus } from "@/components/use-demo";
import { liveNow, useItem } from "@/components/use-item";
import { useLocal } from "@/components/use-local";
import { useMe } from "@/components/use-me";
import { useNow } from "@/components/use-now";
import { WaitPanel } from "@/components/wait-panel";
import { isMock, txUrl } from "@/lib/chain";
import { FINDER_LINES, demoOfTitle } from "@/lib/demo-items";
import { when } from "@/lib/format";
import { itemGuide, stateOf, type Role } from "@/lib/guide";
import { parseRemembered, rememberedRaw } from "@/lib/tx-memory";
import { parseItemId } from "@/lib/rules";

export default function ItemPage() {
  const params = useParams<{ id: string }>();
  const id = parseItemId(String(params?.id ?? ""));
  if (!id)
    return (
      <div className="sheet mx-auto max-w-xl px-5 py-6">
        <h1 className="text-[26px] font-bold">That is not an item number</h1>
        <p className="mt-2 text-ink-2">
          Items are numbered L1, L2, L3 and so on. <Link href="/ledger" className="link">The ledger</Link> lists them all.
        </p>
      </div>
    );
  return <ItemRoom key={id} id={id} />;
}

function ItemRoom({ id }: { id: string }) {
  const me = useMe();
  const r = useItem(id);
  const clock = useNow();
  const { status: demo } = useDemoStatus();
  const remembered = useLocal(() => rememberedRaw(id), "");

  if (r.error && !r.data) return <ReadError error={r.error} retry={r.retry} />;
  if (!r.data) return <Placeholder lines={6} />;
  const { item, claims } = r.data;
  if (!item)
    return (
      <div className="sheet mx-auto max-w-xl px-5 py-6">
        <h1 className="text-[26px] font-bold">No item {id} on this contract</h1>
        <p className="mt-2 text-ink-2">
          It may not be posted yet. <Link href="/ledger" className="link">The ledger</Link> lists every item there is.
        </p>
      </div>
    );

  const now = liveNow(item, clock);
  const latest = claims[0] ?? null;
  const demoItem = !!demoOfTitle(item.title) && !!demo?.bot && item.owner === demo.bot;
  const isOwner = !!me.address && item.owner === me.address;
  const role: Role = isOwner ? "owner" : latest && me.address && latest.finder === me.address ? "finder" : "visitor";
  const state = stateOf({ ...item, now }, latest);
  const myClaims = claims.filter((c) => c.finder === me.address).length;
  const guide = itemGuide(state, role, { reward: item.rewardAtto, now, claimBy: item.claimBy, revealSeconds: item.revealSeconds, revealBy: item.pending?.revealBy ?? latest?.revealBy, demo: demoItem, mock: isMock, myClaims, closedAt: item.closedAt || latest?.settledAt });
  const myPending = !!item.pending && item.pending.finder === me.address;
  const txs = parseRemembered(remembered);
  const online = !!demo && (demo.online || isMock);

  return (
    <div className="flex flex-col gap-8">
      <ItemHead item={item} me={me.address} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {item.sealed ? (
            <FoldedNote marks="" sealed heading="Hidden marks, sealed" footer={<span>Nobody can read them until the owner reveals them to judge a claim. The seal is checked in code; the marks never reach a model before then.</span>} />
          ) : (
            item.revealedMarks && <FoldedNote marks={item.revealedMarks} sealed={false} heading={`The marks revealed at ${when(item.revealedAt)}`} footer={<span className="mono break-all">salt {item.revealedSalt}</span>} />
          )}
          {demoItem && item.status === "open" && !isOwner && (
            <p className="sheet px-4 py-3 text-[15px] text-ink-2">
              This is one of the demo owner&apos;s items. <Link href="/found" className="link">Pick it up on the demo shelf</Link> to see what its finder sees and claim it.
            </p>
          )}
          <section aria-labelledby="claims">
            <h2 id="claims" className="mb-3 text-[22px] font-bold">
              Claims <span className="text-ink-3">({item.claims})</span>
            </h2>
            <ClaimList claims={claims} me={me.address} owner={item.owner} />
          </section>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <WaitPanel guide={guide} />
          {state === "open" && !isOwner && !demoItem && (
            <div className="sheet px-4 py-4">
              <ClaimForm item={item} chips={FINDER_LINES.map((l) => ({ label: l.label, text: l.text, note: l.note }))} />
            </div>
          )}
          {state === "open" && isOwner && !demoItem && (
            <div className="sheet px-4 py-4">
              <DemoFinderBox item={item} online={online} why={demo?.reason || demo?.finderReason || "the site's server did not answer"} />
            </div>
          )}
          {state === "pending" && isOwner && (
            <div className="sheet px-4 py-4">
              <RevealBox item={item} />
            </div>
          )}
          {(state === "no_match" || state === "unclear") && isOwner && item.resealable && (
            <div className="sheet px-4 py-4">
              <ResealBox item={item} />
            </div>
          )}
          {state === "closed" && isOwner && item.withdrawable && <WithdrawRewardBox item={item} />}
          {state === "overdue" && <DefaultBox item={item} mine={myPending} />}
          {demoItem && <DemoOwnerBox item={item} online={online} why={demo?.reason ?? ""} canReveal />}
          {txs.length > 0 && (
            <section aria-labelledby="sent" className="text-[14px]">
              <h2 id="sent" className="head mb-1.5 text-[15px] font-bold">
                Sent from this browser
              </h2>
              <ul className="flex flex-col gap-1">
                {txs.map((t) => (
                  <li key={t.hash} className="flex flex-wrap gap-x-2">
                    <span className="text-ink-2">{t.label}</span>
                    <a href={txUrl(t.hash)} target="_blank" rel="noreferrer" className="mono link text-ink-3">
                      {t.hash.slice(0, 10)}…
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
