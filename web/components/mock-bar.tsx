"use client";

// Mock mode only. There is no wallet and no chain: the visitor acts as one of the demo accounts of the
// in-memory contract, and this bar says so on every page, lets them change account, gives test GEN, and
// moves the clock on so a reveal window or a claim deadline can be seen running out.

import { useLocal } from "@/components/use-local";
import { PERSONAS, advanceClock, mockAddress, mockBalanceText, mockClockOffset, setMockPersona } from "@/lib/chain-mock";
import { faucet } from "@/lib/chain";
import { gen, span } from "@/lib/format";

const small = "h-8 rounded-md border-[1.5px] border-kraft-2 bg-paper px-2 text-xs font-bold head hover:bg-kraft-wash active:translate-y-px";

export function MockBar() {
  const address = useLocal(mockAddress, PERSONAS[0].address);
  const balance = useLocal(() => mockBalanceText(mockAddress()), "0");
  const offset = useLocal(mockClockOffset, 0);
  return (
    <div className="border-b border-dashed border-kraft-2/60 bg-kraft-wash">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-2 px-4 py-2 text-xs lg:flex-row lg:items-center lg:justify-between">
        <p className="min-w-0">
          <strong className="head font-bold">Demo build.</strong> An in-memory copy of the contract. No model is asked here: a reveal is judged by counting the words of each mark, where on chain every
          validator reads both texts with its own model. A reload starts again.
        </p>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <label htmlFor="mock-persona" className="head shrink-0 font-bold">
            Acting as
          </label>
          <select id="mock-persona" value={address} onChange={(e) => setMockPersona(e.target.value)} className="h-8 max-w-full min-w-0 rounded-md border-[1.5px] border-kraft-2 bg-paper px-1.5 text-xs">
            {PERSONAS.map((p) => (
              <option key={p.address} value={p.address}>
                {p.name}: {p.note}
              </option>
            ))}
          </select>
          <span className="mono whitespace-nowrap">{gen(balance)}</span>
          <button type="button" onClick={() => void faucet(address)} className={small}>
            +10 GEN
          </button>
          <button type="button" onClick={() => advanceClock(600)} className={small}>
            Clock +10 min
          </button>
          <button type="button" onClick={() => advanceClock(86400)} className={small}>
            +1 day
          </button>
          <button type="button" onClick={() => advanceClock(30 * 86400)} className={small}>
            +30 days
          </button>
          {offset > 0 && <span className="text-ink-2">clock moved on {span(offset)}</span>}
        </div>
      </div>
    </div>
  );
}
