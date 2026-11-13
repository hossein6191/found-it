"use client";

// Writing hidden marks and sealing them: the marks field with its chips and the contract's limits, a
// fresh salt made in this browser, and the digest the contract will store, computed exactly as it checks
// it: sha256(hidden_marks + "|" + salt). The marks and the salt are kept in this browser's storage when
// the seal is sent, and shown here to copy, because nobody else holds them: lose both and a claim cannot
// be answered, which pays it by default.

import * as React from "react";

import { Button } from "@/components/button";
import { IconCopy } from "@/components/icons";
import { Suggest } from "@/components/suggest";
import { MAX_MARKS, marksProblem, pyLen, sentence } from "@/lib/rules";
import { newSalt, sealOf, sealedText } from "@/lib/seal";
import { MARKS_CHIPS } from "@/lib/suggestions";

export type SealDraft = { marks: string; salt: string; digest: string; problem: string };

export function useSealDraft(): SealDraft & { setMarks: (m: string) => void; reroll: () => void } {
  const [marks, setMarks] = React.useState("");
  const [salt, setSalt] = React.useState("");
  React.useEffect(() => {
    // A salt is made in the browser only, after the page is on screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSalt(newSalt());
  }, []);
  const text = sealedText(marks);
  const problem = marks ? marksProblem(text) : "the text of the hidden marks is 20 to 500 characters";
  const digest = text && salt && !problem ? sealOf(text, salt) : "";
  return { marks, salt, digest, problem, setMarks, reroll: () => setSalt(newSalt()) };
}

export function SealEditor({ draft, id, title }: { draft: ReturnType<typeof useSealDraft>; id: string; title?: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Found It seal${title ? " for " + title : ""}\nhidden marks: ${sealedText(draft.marks)}\nsalt: ${draft.salt}\ndigest: ${draft.digest}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the three lines are on screen to copy by hand */
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor={`marks-${id}`} className="label">
          Hidden marks
        </label>
        <p className="mt-0.5 text-[14px] text-ink-2">Three details only someone holding the item would see, separated by semicolons. Specific enough that a guess cannot name two; plain enough that the finder can.</p>
        <textarea id={`marks-${id}`} className="field mt-2 min-h-[96px]" maxLength={MAX_MARKS} value={draft.marks} onChange={(e) => draft.setMarks(e.target.value)} placeholder="a red tag reading …; a cracked …; a card for …" />
        <div className="mt-1 flex flex-wrap justify-between gap-2 text-[13px]">
          <span className={draft.marks && draft.problem ? "text-twine-deep" : "text-ink-3"}>{draft.marks && draft.problem ? sentence(draft.problem) : "Sealed exactly as written, without the spaces at either end."}</span>
          <span className="mono text-ink-3">
            {pyLen(draft.marks)} / {MAX_MARKS}
          </span>
        </div>
        <Suggest label="Suggested marks" chips={MARKS_CHIPS} onPick={draft.setMarks} isOn={(v) => v === draft.marks} />
      </div>
      <div className="rounded-lg border-[1.5px] border-dashed border-twine/50 bg-twine-wash/50 p-3 text-[14px]">
        <p className="head font-bold text-twine-deep">Keep these two safe</p>
        <p className="mt-1 text-ink-2">
          The contract stores only the digest. Your marks and this salt are kept in this browser when you send, and nowhere else. Copy them somewhere you keep: on another device, or after clearing this browser, they are the
          only way to answer a claim, and a claim you cannot answer is paid by default.
        </p>
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
          <dt className="head text-[12px] font-bold text-ink-3 uppercase">Salt</dt>
          <dd className="mono min-w-0 break-all">{draft.salt || "…"}</dd>
          <dt className="head text-[12px] font-bold text-ink-3 uppercase">Digest</dt>
          <dd className="mono min-w-0 break-all text-ink-2">{draft.digest || "appears once the marks are long enough"}</dd>
        </dl>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button size="sm" variant="paper" icon={<IconCopy />} disabled={!draft.digest} onClick={() => void copy()}>
            {copied ? "Copied" : "Copy marks, salt and digest"}
          </Button>
          <Button size="sm" variant="paper" onClick={draft.reroll}>
            New salt
          </Button>
        </div>
      </div>
    </div>
  );
}
