"use client";

// One item and its newest claims, read together, re-read in place whenever a transaction on the page is
// final, and asked again every so often while the item waits on somebody else (a claim pending, a
// reveal being judged), so a page left open catches up by itself.

import * as React from "react";

import { useAfterTx, useRead, type ReadState } from "@/components/use-read";
import { isMock, readClaimsNewest, readItem } from "@/lib/chain";
import type { Claim, Item } from "@/lib/types";

export type ItemRead = { item: Item | null; claims: Claim[] };

export function useItem(id: string, opts: { poll?: boolean } = {}): ReadState<ItemRead> {
  const fresh = React.useRef(false);
  const r = useRead<ItemRead>(
    async () => {
      const f = fresh.current;
      fresh.current = false;
      const item = (await readItem(id, { fresh: f })).data;
      const claims = item ? (await readClaimsNewest(id, item.claims, { fresh: f })).data : [];
      return { data: { item, claims }, source: isMock ? "mock" : "chain" };
    },
    [id],
    { enabled: !!id },
  );
  const refresh = r.refresh;
  const freshRefresh = React.useCallback(() => {
    fresh.current = true;
    return refresh();
  }, [refresh]);
  useAfterTx(freshRefresh);
  const status = r.data?.item?.status;
  const poll = opts.poll ?? (status === "claimed");
  React.useEffect(() => {
    if (!poll) return;
    const t = setInterval(() => void freshRefresh(), isMock ? 2500 : 20_000);
    return () => clearInterval(t);
  }, [poll, freshRefresh]);
  return { ...r, refresh: freshRefresh };
}

/** The chain's clock now, from the view's own clock and how long ago it was read. */
export const liveNow = (item: Pick<Item, "now" | "readAt">, browserNow: number): number => (item.now && item.readAt && browserNow ? item.now + Math.max(0, browserNow - item.readAt) : item.now);
