"use client";

// The room every page stands in: the header with the mark, the five places and the wallet; the demo bar
// in mock mode; the wrong-chain banner; and the footer with the contract, the network and the source.

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { IconExternal } from "@/components/icons";
import { Logo } from "@/components/logo";
import { MockBar } from "@/components/mock-bar";
import { WalletButton, WrongChainBanner } from "@/components/wallet";
import { addressUrl, contractInUse, hasContract, isMock } from "@/lib/chain";
import { REPO_URL, SITE_NAME } from "@/lib/config";
import { cx } from "@/lib/cx";
import { short } from "@/lib/format";

const NAV = [
  { href: "/found", label: "Found something" },
  { href: "/lost", label: "Lost something" },
  { href: "/mine", label: "Mine" },
  { href: "/ledger", label: "Ledger" },
  { href: "/how", label: "How" },
];

export function AppFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "/";
  const contract = contractInUse();
  return (
    <div className="wall flex min-h-screen flex-col">
      <header className="border-b-[3px] border-wood-2 bg-paper/95">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={`${SITE_NAME}, home`}>
            <Logo size={36} />
            <span className="head text-[22px] font-bold tracking-tight">{SITE_NAME}</span>
          </Link>
          <nav aria-label="Main" className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
            <ul className="flex flex-wrap gap-x-1 gap-y-1">
              {NAV.map((n) => {
                const on = path === n.href || path.startsWith(n.href + "/");
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      aria-current={on ? "page" : undefined}
                      className={cx("head inline-block rounded-md px-2.5 py-1.5 text-[14.5px] font-semibold", on ? "bg-kraft-wash text-ink underline decoration-twine decoration-2 underline-offset-4" : "text-ink-2 hover:bg-room-2 hover:text-ink")}
                    >
                      {n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="ml-auto min-w-0">{isMock ? <span className="head rounded-md border border-dashed border-kraft-2 px-2 py-1 text-xs font-semibold text-ink-2">Demo build, no wallet</span> : <WalletButton />}</div>
        </div>
      </header>
      {isMock ? <MockBar /> : <WrongChainBanner />}
      {!hasContract() && (
        <div role="status" className="border-b border-line bg-ochre-wash px-4 py-2 text-center text-sm text-ochre">
          The contract is not deployed yet, so there is nothing to read or sign. Every page still shows what it will do.
        </div>
      )}
      <main id="main" className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-6 pb-16 sm:pt-9">
        {children}
      </main>
      <footer className="border-t-[3px] border-wood-2 bg-room-2">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-2 px-4 py-5 text-sm text-ink-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p>
            <span className="head font-bold text-ink">{SITE_NAME}</span>, an Intelligent Contract on GenLayer Studio (chain 61999).
          </p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {contract && (
              <a href={addressUrl(contract)} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">
                contract <span className="mono">{short(contract)}</span> <IconExternal size={12} />
              </a>
            )}
            {REPO_URL && (
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">
                Source <IconExternal size={12} />
              </a>
            )}
            <Link href="/how" className="link">
              The rules, read live
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
