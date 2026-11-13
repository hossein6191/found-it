// POST /api/demo/repost {item}: the demo owner posts a demo item again, as a new item with its first mark
// set, once the newest item of its kind was returned (a match or a default paid its reward).
// Rate-limited per item and in total, one signature at a time; answers the transaction hash or why not.
// Nothing here ever logs or returns the key, and nothing the visitor sends but the item id is used.

import { sendRepost } from "@/lib/demo-server";
import { parseItemId } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A few reads (retried while Studio is slow), perhaps a faucet payment, and one signature.
export const maxDuration = 60;

const noStore = { "cache-control": "no-store" };

export async function POST(request: Request) {
  let id = "";
  try {
    const text = await request.text();
    if (text.length > 200) throw new Error("too long");
    const body = JSON.parse(text) as { item?: unknown };
    id = typeof body.item === "string" ? parseItemId(body.item) : "";
  } catch {
    id = "";
  }
  if (!id) return Response.json({ ok: false, reason: 'send {"item": "L1"}' }, { status: 400, headers: noStore });
  const answer = await sendRepost(id);
  return Response.json(answer.body, { status: answer.status, headers: noStore });
}
