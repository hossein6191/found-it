"use client";

// The demo shelf, where one visitor plays the finder. Three lost items the demo owner keeps posted: pick
// one off the shelf and you are holding it, with what you see when you open it (its current hidden
// marks, shown here and nowhere else, as the scene of the find). Describe it with a chip or in your own
// words, hold the bond, claim; the site then asks the demo owner to reveal its marks and salt, the
// validators judge your description in that same transaction, and the slip says where the money went.
// An item a judged claim left exposed is resealed with the next marks of its rotation when you ask; a
// returned one goes back on the shelf.

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/button";
import { ClaimForm } from "@/components/claim-form";
import { DemoStage, useDemoCall } from "@/components/demo-call";
import { DefaultBox, DemoOwnerBox } from "@/components/item-actions";
import { FoldedNote } from "@/components/note";
import { Parcel, PARCEL_WORD } from "@/components/parcel";
import { Placeholder, ReadError } from "@/components/read-state";
import { ResultSlip } from "@/components/slip";
import { useDemoStatus } from "@/components/use-demo";
import { liveNow, useItem } from "@/components/use-item";
import { useMe } from "@/components/use-me";
import { useNow } from "@/components/use-now";
import { useSearchString } from "@/components/use-read";
import { WaitPanel } from "@/components/wait-panel";
import { calls, hasContract, isMock, itemPath, requestDemoReveal } from "@/lib/chain";
import { DEMO_ITEMS, descriptionChips, setOfSeal, type DemoItem, type DemoSlug } from "@/lib/demo-items";
import { gen } from "@/lib/format";
import { itemGuide, stateOf, type Role } from "@/lib/guide";
import { rememberTx } from "@/lib/tx-memory";
import type { DemoStatus } from "@/lib/types";

const slugOf = (search: string): DemoSlug | null => {
  const v = new URLSearchParams(search).get("item");
  return v === "backpack" || v === "umbrella" || v === "scarf" ? v : null;
};

export default function FoundPage() {
  const search = useSearchString();
  const [picked, setPicked] = React.useState<DemoSlug | null>(null);
  const slug = picked ?? slugOf(search);
  const { status: demo, refresh } = useDemoStatus();
  const pick = (s: DemoSlug) => {
    setPicked(s);
    try {
      window.history.replaceState(null, "", `/found?item=${s}`);
    } catch {
      /* the address bar keeps its old query; nothing else depends on it */
    }
  };
  const chosen = slug ? DEMO_ITEMS.find((d) => d.slug === slug)! : null;
  const shelfItem = chosen && demo ? demo.items.find((i) => i.slug === chosen.slug) : undefined;

  return (
    <div className="flex flex-col gap-8">
      <header className="max-w-[46rem]">
        <p className="head text-[13px] font-bold tracking-[0.16em] text-twine-deep uppercase">Play the finder</p>
        <h1 className="mt-1 text-[34px] font-bold sm:text-[44px]">The demo shelf</h1>
        <p className="mt-3 text-[17px] text-ink-2">
          Three things were lost this week, and their owner is waiting with a reward. Pick one up: you are the one who found it. Describe what you see inside, and the validators decide whether that proves the find.
        </p>
      </header>

      <DemoShelf demo={demo} selected={slug} onPick={pick} />

      {!hasContract() ? null : demo && !demo.online && !isMock ? (
        <p className="sheet px-4 py-3 text-[15px] text-ochre">
          The demo owner is away right now: {demo.reason}. You can still post an item of your own on <Link href="/lost" className="link">Lost something</Link>.
        </p>
      ) : null}

      {chosen && shelfItem?.item ? (
        <FoundDesk key={shelfItem.item} id={shelfItem.item} d={chosen} demo={demo!} onReposted={refresh} />
      ) : chosen && demo ? (
        <p className="sheet px-4 py-3 text-[15px] text-ink-2">The {chosen.slug} is not on the shelf on this contract yet. Once the demo owner posts it, it appears here.</p>
      ) : null}
    </div>
  );
}

function DemoShelf({ demo, selected, onPick }: { demo: DemoStatus | null; selected: DemoSlug | null; onPick: (s: DemoSlug) => void }) {
  return (
    <div className="shelf">
      <div className="shelf-bay grid grid-cols-1 gap-x-4 gap-y-5 pb-1 sm:grid-cols-3">
        {DEMO_ITEMS.map((d) => {
          const s = demo?.items.find((i) => i.slug === d.slug);
          const on = selected === d.slug;
          return (
            <button
              key={d.slug}
              type="button"
              onClick={() => onPick(d.slug)}
              aria-pressed={on}
              className={`group flex flex-col items-center gap-2 rounded-xl px-2 pt-2 pb-1 text-center transition-colors ${on ? "bg-paper/70 ring-2 ring-twine" : "hover:bg-paper/50"}`}
            >
              <span className="head text-[15.5px] leading-tight font-bold">{d.title}</span>
              <span className="text-[13.5px] text-ink-2">
                reward <span className="mono font-semibold text-ink">{gen(d.rewardAtto)}</span>
                {s?.status ? ` · ${PARCEL_WORD[s.status]}` : ""}
              </span>
              <Parcel id={s?.item ?? ""} status={s?.status ?? "open"} size={200} title={d.title} className="transition-transform group-hover:-translate-y-1" />
            </button>
          );
        })}
      </div>
      <div className="plank" />
    </div>
  );
}

function FoundDesk({ id, d, demo, onReposted }: { id: string; d: DemoItem; demo: DemoStatus; onReposted: () => void }) {
  const me = useMe();
  const r = useItem(id);
  const clock = useNow();
  const reveal = useDemoCall((_s, hash) => rememberTx(id, hash, "demo owner reveal"));
  const asked = React.useRef<string>("");
  const { ask } = reveal;
  const askReveal = React.useCallback(() => {
    void ask("reveal", () => requestDemoReveal(id), calls.reveal(id, "", ""));
  }, [ask, id]);

  const item = r.data?.item ?? null;
  const claims = r.data?.claims ?? [];
  const latest = claims[0] ?? null;
  const pending = item?.pending ?? null;
  const myPending = !!pending && !!me.address && pending.finder === me.address;

  // A pending claim of yours that the demo owner has not been asked about from this page: ask, once.
  React.useEffect(() => {
    if (!myPending || !pending || item?.defaultable || asked.current === pending.id) return;
    asked.current = pending.id;
    askReveal();
  }, [myPending, pending, item?.defaultable, askReveal]);

  if (r.error && !item) return <ReadError error={r.error} retry={r.retry} />;
  if (!item) return <Placeholder lines={5} />;

  const now = liveNow(item, clock);
  const judging = !!reveal.tx.hash && !reveal.tx.final;
  const role: Role = me.address && item.owner === me.address ? "owner" : latest && me.address && latest.finder === me.address ? "finder" : "visitor";
  const state = stateOf({ ...item, now }, latest, judging);
  const myClaims = claims.filter((c) => c.finder === me.address).length;
  const guide = itemGuide(state, role, { reward: item.rewardAtto, now, claimBy: item.claimBy, revealSeconds: item.revealSeconds, revealBy: pending?.revealBy ?? latest?.revealBy, demo: true, mock: isMock, myClaims, closedAt: item.closedAt || latest?.settledAt });
  const set = setOfSeal(d, item.seals);
  const settledMine = latest && latest.status === "settled" && latest.finding && latest.finder === me.address;

  return (
    <section aria-labelledby="desk" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-5">
        <div>
          <p className="head text-[13px] font-bold tracking-[0.14em] text-ink-3 uppercase">
            Shelf {item.id} · seal {item.seals}
          </p>
          <h2 id="desk" className="mt-1 text-[28px] font-bold">
            {state === "open" ? "You found it." : item.title}
          </h2>
          <p className="mt-2 text-[16px] text-ink-2">
            {state === "open" ? `You picked up the ${d.slug} ${d.place}. ` : ""}
            {item.publicDescription}
          </p>
        </div>
        {(state === "open" || state === "pending" || state === "judging" || state === "overdue") && (
          <FoldedNote
            marks={set.marks}
            sealed={false}
            heading="What you see when you open it"
            footer={
              <span>
                The owner sealed these before anybody claimed. Only this page shows them, because you are holding the item; on the <Link href={itemPath(item.id)} className="link">item&apos;s own page</Link> they stay sealed until a
                claim is judged.
              </span>
            }
          />
        )}
        {(item.status === "exposed" || item.status === "returned") && item.revealedMarks && <FoldedNote marks={item.revealedMarks} sealed={false} heading="The marks the owner revealed" />}
        {settledMine && latest ? (
          <ResultSlip finding={latest.finding as "match"} rewardAtto={latest.rewardAtto} bondAtto={latest.bondAtto} why={latest.why} claim={latest.id} item={item.id} youAre="finder" />
        ) : latest && latest.status === "settled" && latest.finding && state !== "open" ? (
          <ResultSlip finding={latest.finding as "match"} rewardAtto={latest.rewardAtto} bondAtto={latest.bondAtto} why={latest.why} claim={latest.id} item={item.id} youAre="visitor" />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <WaitPanel
          guide={guide}
          action={
            myPending && !judging && !reveal.asking && (reveal.reason || reveal.tx.final) && state === "pending" ? (
              <Button size="sm" onClick={askReveal}>
                Ask the demo owner to reveal again
              </Button>
            ) : undefined
          }
        />
        <DemoStage call={reveal} label={`The demo owner reveals ${item.id}; the validators judge`} reward={item.rewardAtto} mock={isMock} hideFinal={false} />

        {state === "open" && (
          <div className="sheet px-4 py-4">
            <ClaimForm
              item={item}
              chips={descriptionChips(set).map((c) => ({ label: c.label, text: c.text, note: c.expect }))}
              onClaimed={(cid, hash) => {
                rememberTx(item.id, hash, `claim ${cid}`);
                asked.current = cid;
                askReveal();
              }}
            />
          </div>
        )}

        {state === "overdue" && <DefaultBox item={item} mine={myPending} />}
        <DemoOwnerBox item={item} online={demo.online || isMock} why={demo.reason} canReveal={false} />
        {item.status === "returned" && <RepostWatcher onReposted={onReposted} />}
        <p className="text-[14px] text-ink-3">
          Every claim on {item.id}, with its finding: <Link href={itemPath(item.id)} className="link">the item&apos;s page</Link>.
        </p>
      </div>
    </section>
  );
}

/** Once a returned item is posted again, the shelf reads the demo owner's items afresh. */
function RepostWatcher({ onReposted }: { onReposted: () => void }) {
  React.useEffect(() => {
    const t = setInterval(onReposted, isMock ? 2000 : 15_000);
    return () => clearInterval(t);
  }, [onReposted]);
  return null;
}
