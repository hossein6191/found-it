// POST /api/demo/claim {item, line}: the demo finder claims an open item a visitor posted, with ONE of its
// three fixed lines ("accurate", "vague" or "wrong", lib/demo-items.ts). The line is a key into that list;
// no text from the visitor is ever signed. When its credit holds less than a bond it deposits a little
// first and asks to be asked again. Rate-limited per item and in total, one signature at a time; answers
// the transaction hash or why not. Nothing here ever logs or returns the key.

import { FINDER_LINES, isFinderLine } from "@/lib/demo-items";
import { sendClaim } from "@/lib/demo-server";
import { parseItemId } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A few reads (retried while Studio is slow), perhaps a faucet payment, and one signature.
export const maxDuration = 60;

const noStore = { "cache-control": "no-store" };

export async function POST(request: Request) {
  let id = "";
  let line = "";
  try {
    const text = await request.text();
    if (text.length > 200) throw new Error("too long");
    const body = JSON.parse(text) as { item?: unknown; line?: unknown };
    id = typeof body.item === "string" ? parseItemId(body.item) : "";
    line = isFinderLine(body.line) ? body.line : "";
  } catch {
    id = "";
  }
  if (!id || !isFinderLine(line))
    return Response.json({ ok: false, reason: `send {"item": "L1", "line": one of ${FINDER_LINES.map((l) => l.key).join(", ")}}` }, { status: 400, headers: noStore });
  const answer = await sendClaim(id, line);
  return Response.json(answer.body, { status: answer.status, headers: noStore });
}
