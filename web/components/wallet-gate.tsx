"use client";

// What a page shows in place of its action while nobody can sign: connect a wallet, switch it to Studio,
// or (with no contract deployed) why nothing can be signed at all.

import { Button } from "@/components/button";
import { IconWallet } from "@/components/icons";
import { useMe } from "@/components/use-me";
import { useWallet } from "@/components/wallet";
import { hasContract, isMock } from "@/lib/chain";

export function WalletGate({ doing, children }: { doing: string; children: React.ReactNode }) {
  const me = useMe();
  const w = useWallet();
  if (!hasContract()) return <p className="sheet px-4 py-3 text-sm text-ink-2">The contract is not deployed yet, so nothing can be signed. The page still shows what {doing} will do.</p>;
  if (me.ready) return <>{children}</>;
  if (isMock) return <p className="sheet px-4 py-3 text-sm text-ink-2">Pick an account in the demo bar above to {doing}.</p>;
  if (w.address && !w.onStudio)
    return (
      <div className="sheet flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
        <p className="text-ink-2">Your wallet is on another network. Switch it to GenLayer Studio to {doing}.</p>
        <Button size="sm" onClick={() => void w.switchToStudio()}>
          Switch to Studio
        </Button>
      </div>
    );
  return (
    <div className="sheet flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
      <p className="text-ink-2">Connect a wallet to {doing}. Nothing is signed by connecting; the wallet asks you first.</p>
      <Button size="sm" icon={<IconWallet size={16} />} disabled={w.connecting} onClick={() => void w.connect()}>
        {w.connecting ? "Connecting…" : "Connect a wallet"}
      </Button>
      {w.error && <p className="w-full text-twine-deep">{w.error}</p>}
    </div>
  );
}
