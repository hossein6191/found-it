import Link from "next/link";

import { Parcel } from "@/components/parcel";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-10 text-center">
      <Parcel id="" status="withdrawn" size={180} />
      <h1 className="text-[32px] font-bold">Nothing on this shelf</h1>
      <p className="text-ink-2">This page is not here. The items are on the demo shelf and in the ledger.</p>
      <p className="flex gap-4">
        <Link href="/found" className="link">
          The demo shelf
        </Link>
        <Link href="/ledger" className="link">
          The ledger
        </Link>
      </p>
    </div>
  );
}
