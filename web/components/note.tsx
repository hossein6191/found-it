// The hidden marks as a folded note inside the parcel: printed lines, one mark each, blurred while the
// seal holds them, legible once they are revealed (or, on the finder's page, because the finder holds
// the item and is reading them off it).

import { cx } from "@/lib/cx";

/** The marks one per line: an owner writes them separated by semicolons. */
export const marksLines = (marks: string): string[] =>
  marks
    .split(";")
    .map((m) => m.trim())
    .filter(Boolean);

export function FoldedNote({ marks, sealed, heading, footer, className }: { marks: string; sealed: boolean; heading?: string; footer?: React.ReactNode; className?: string }) {
  const lines = sealed ? ["three things only the owner knows", "written down before anybody claimed", "sealed as one sha256 digest"] : marksLines(marks);
  return (
    <figure className={cx("note px-4 pt-3 pb-4", sealed && "note-sealed", className)}>
      <figcaption className="head text-[12px] font-bold tracking-[0.14em] text-ink-3 uppercase">{heading ?? (sealed ? "Hidden marks, sealed" : "Hidden marks")}</figcaption>
      {sealed && <p className="sr-only">The hidden marks are sealed: nobody can read them until the owner reveals them to judge a claim.</p>}
      <ol className="note-text mt-2 flex flex-col gap-1.5" aria-hidden={sealed || undefined}>
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2.5 text-[15.5px] leading-snug">
            <span className="mono shrink-0 pt-0.5 text-ink-3">{i + 1}.</span>
            <span className="min-w-0 break-words">{l}</span>
          </li>
        ))}
      </ol>
      {footer && <div className="mt-3 border-t border-dashed border-line-2 pt-2 text-[13px] text-ink-2">{footer}</div>}
    </figure>
  );
}
