"use client";

// The waiting panel: a sheet of paper on the shelf edge saying what is happening now, then five short
// lines (how long, whether you must act, whether you can leave, where the money is), a counter, and the
// next button when there is one. The words come from lib/guide.ts, the same for every in-between state.
// A busy panel scrolls itself into view when it first appears; a calm one never moves the page.

import * as React from "react";

import { IconCheck, IconHand, IconTimer } from "@/components/icons";
import { useWallNow } from "@/components/use-now";
import { cx } from "@/lib/cx";
import type { Guide, GuideTone } from "@/lib/guide";

/** "0:42", "12:05", "1:02:09"; longer than a day, "2 d 3 h". */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  if (d > 0) {
    const h = Math.floor((s % 86400) / 3600);
    return h ? `${d} d ${h} h` : `${d} d`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

const EDGE: Record<GuideTone, string> = {
  busy: "border-l-twine",
  clock: "border-l-kraft-2",
  act: "border-l-twine-deep",
  ready: "border-l-green-2",
  done: "border-l-green",
};

const KICK: Record<GuideTone, string> = {
  busy: "text-twine-deep",
  clock: "text-ink-2",
  act: "text-twine-deep",
  ready: "text-green",
  done: "text-green",
};

export function WaitPanel({ guide, since, left, action, scene, className }: { guide: Guide; since?: number; left?: number; action?: React.ReactNode; scene?: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const wall = useWallNow();
  React.useEffect(() => {
    const el = ref.current;
    if (guide.tone !== "busy" || !el || typeof el.scrollIntoView !== "function") return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [guide.id, guide.tone]);

  const remaining = left ?? guide.left;
  const counter =
    remaining !== undefined && remaining > 0 ? { text: clockText(remaining), label: guide.leftLabel ?? "left" } : since && wall ? { text: clockText(wall - since), label: "so far" } : null;

  return (
    <section ref={ref} data-wait={guide.id} className={cx("sheet scroll-mt-4 scroll-mb-4 border-l-[6px] px-4 pt-3.5 pb-4 sm:px-5", EDGE[guide.tone], className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0" role="status" aria-live="polite" aria-atomic="true">
          <p className={cx("head flex items-center gap-1.5 text-[12px] font-bold tracking-[0.12em] uppercase", KICK[guide.tone])}>
            {guide.tone === "done" || guide.tone === "ready" ? <IconCheck size={14} /> : guide.tone === "act" ? <IconHand size={14} /> : <IconTimer size={14} />}
            {guide.kicker}
          </p>
          <p className="head mt-1 text-[19px] leading-snug font-bold">{guide.now}</p>
        </div>
        {counter && (
          <div className="shrink-0 rounded-md border border-line-2 bg-room-2 px-2.5 py-1.5 text-right">
            <p className="mono text-[19px] leading-none font-semibold text-ink">{counter.text}</p>
            <p className="head mt-1 text-[10.5px] font-bold tracking-[0.1em] text-ink-3 uppercase">{counter.label}</p>
          </div>
        )}
      </div>
      {scene && <div className="mt-3">{scene}</div>}
      {guide.note && <p className="mt-2 text-[14px] text-ink-2">{guide.note}</p>}
      <dl className="mt-2.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 text-[14.5px] leading-[1.45]">
        <Line label="How long">{guide.time}</Line>
        <Line label="From you" strong={guide.mustAct}>
          {guide.need}
        </Line>
        <Line label="Leave?" warn={!guide.canLeave}>
          {guide.leave}
        </Line>
        <Line label="Money">{guide.money}</Line>
      </dl>
      {action && <div className="mt-3 flex flex-wrap items-center gap-2">{action}</div>}
    </section>
  );
}

function Line({ label, children, strong, warn }: { label: string; children: React.ReactNode; strong?: boolean; warn?: boolean }) {
  return (
    <>
      <dt className="head border-t border-line pt-1.5 pb-1 text-[11.5px] font-bold tracking-[0.08em] whitespace-nowrap text-ink-3 uppercase">{label}</dt>
      <dd className={cx("min-w-0 border-t border-line pt-1.5 pb-1", strong ? "font-semibold text-ink" : warn ? "font-semibold text-twine-deep" : "text-ink-2")}>{children}</dd>
    </>
  );
}
