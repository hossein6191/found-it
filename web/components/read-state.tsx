"use client";

// The three states of every read: a quiet placeholder while it loads, the data, or "could not reach the
// network" with a retry. A failed read is never shown as "nothing here".

import { Button } from "@/components/button";
import { NO_CONTRACT, RATE_LIMITED } from "@/lib/chain";

export function Placeholder({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="block h-4 rounded bg-line/70" style={{ width: `${92 - i * 14}%` }} />
      ))}
    </div>
  );
}

export function ReadError({ error, retry }: { error: string; retry: () => void }) {
  const text =
    error === NO_CONTRACT
      ? "The contract is not deployed yet, so there is nothing to read."
      : error === RATE_LIMITED
        ? "Studio is rate-limiting this browser for a moment (30 reads a minute). The page asks again by itself; or retry in a few seconds."
        : "Could not reach the network. Studio sometimes drops a request; nothing is lost.";
  return (
    <div role="alert" className="sheet flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
      <p className="text-ink-2">{text}</p>
      {error !== NO_CONTRACT && (
        <Button size="sm" variant="paper" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
