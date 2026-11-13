// An address, shortened, linked to the explorer; "you" when it is the viewer's own.

import { IconExternal } from "@/components/icons";
import { addressUrl, isMock } from "@/lib/chain";
import { short } from "@/lib/format";

export function Addr({ address, me, label }: { address: string; me?: string; label?: string }) {
  if (!address) return <span className="text-ink-3">nobody</span>;
  const mine = !!me && me.toLowerCase() === address.toLowerCase();
  const text = (
    <>
      <span className="mono">{short(address)}</span>
      {mine && <span className="head ml-1 text-[12px] font-bold text-twine-deep">(you)</span>}
      {label && <span className="ml-1 text-ink-3">{label}</span>}
    </>
  );
  if (isMock) return <span className="whitespace-nowrap">{text}</span>;
  return (
    <a href={addressUrl(address)} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 whitespace-nowrap">
      {text}
      <IconExternal size={11} />
    </a>
  );
}
