// Small formatters shared by every page, pure.

import { GEN } from "./rules.ts";

/** "0.12 GEN" from atto: up to four decimals, trailing zeros dropped. */
export function gen(atto: string | bigint, decimals = 4): string {
  let v: bigint;
  try {
    v = typeof atto === "bigint" ? atto : BigInt(String(atto || "0"));
  } catch {
    v = 0n;
  }
  const neg = v < 0n;
  const a = neg ? -v : v;
  const whole = a / GEN;
  const frac = (a % GEN).toString().padStart(18, "0").slice(0, decimals).replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toString()}${frac ? "." + frac : ""} GEN`;
}

/** GEN typed by a person ("0.25") into atto, or null when it is not a plain amount. */
export function toAtto(text: string): bigint | null {
  const t = String(text ?? "").trim();
  const m = /^(\d{1,6})(?:\.(\d{1,18}))?$/.exec(t);
  if (!m) return null;
  return BigInt(m[1]) * GEN + BigInt((m[2] ?? "").padEnd(18, "0") || "0");
}

/** "3 min", "2 h 5 min", "4 days": a span of seconds in words. */
export function span(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d >= 2) return h ? `${d} days ${h} h` : `${d} days`;
  if (d === 1) return h ? `1 day ${h} h` : "1 day";
  if (h) return m ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}

/** "13 Nov, 14:05" in the reader's own zone, from unix seconds; "" for 0. */
export function when(seconds: number): string {
  if (!seconds) return "";
  try {
    return new Date(seconds * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return new Date(seconds * 1000).toISOString().slice(0, 16).replace("T", " ");
  }
}

/** "0x1234…abcd" */
export const short = (a: string): string => (a && a.length > 12 ? a.slice(0, 6) + "…" + a.slice(-4) : a);

/** "1a2b3c4d…9f8e": a digest, shortened. */
export const shortHex = (h: string, head = 10, tail = 6): string => (h && h.length > head + tail + 1 ? h.slice(0, head) + "…" + h.slice(-tail) : h);

/** The shelf number painted on a parcel: "L7" as "07", "L123" as "123". */
export const shelfNumber = (id: string): string => {
  const n = /^L(\d+)$/.exec(id)?.[1] ?? "";
  return n.length < 2 ? n.padStart(2, "0") : n;
};
