"use client";

// Whether the demo bot can act right now, its three items, and exactly why not (null while asking). It
// asks again whenever the chain moves under the page, so a reposted item shows up on the shelf.

import * as React from "react";

import { useLocal } from "@/components/use-local";
import { chainVersion, readDemoStatus } from "@/lib/chain";
import type { DemoStatus } from "@/lib/types";

export function useDemoStatus(): { status: DemoStatus | null; refresh: () => void } {
  const [status, setStatus] = React.useState<DemoStatus | null>(null);
  const [tick, setTick] = React.useState(0);
  const version = useLocal(chainVersion, 0);
  React.useEffect(() => {
    let live = true;
    void readDemoStatus({ fresh: tick > 0 || version > 0 }).then((s) => {
      if (live) setStatus(s);
    });
    return () => {
      live = false;
    };
  }, [tick, version]);
  const refresh = React.useCallback(() => setTick((t) => t + 1), []);
  return { status, refresh };
}
