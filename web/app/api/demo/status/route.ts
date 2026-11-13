// GET /api/demo/status: whether the demo bot can act now, its public address, its three demo items with
// their status, whether it can claim as the demo finder, and exactly why not when it cannot: "no key
// set", "the key set is not a 0x private key of 64 hex characters", "the contract is not deployed yet",
// Studio's RPC not answering, no GEN on its account, or the demo items not posted on this contract yet.
// The key itself is never echoed.

import { demoStatusNow } from "@/lib/demo-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A balance read (perhaps a faucet payment), one read of items_of and one of credit, retried while Studio is slow.
export const maxDuration = 60;

export async function GET() {
  return Response.json(await demoStatusNow(), { headers: { "cache-control": "no-store" } });
}
