// The owner's hidden marks and salt, kept in this browser only. The contract stores the digest and never
// the marks, so without these two a seal cannot be opened, and a claim the owner cannot answer is paid
// by default. Every page that seals says so, and shows both for copying. Keyed by the contract in use
// and the digest, so a seal is found again from the item's own marks_digest.

import { readItem, writeItem } from "./browser-store.ts";
import { contractAddress } from "./config.ts";
import { sealOf } from "./seal.ts";

export type LocalSeal = { digest: string; marks: string; salt: string; title: string; item: string; savedAt: number };

const MOCK = process.env.NEXT_PUBLIC_MOCK === "1";
// The in-memory contract of mock mode starts again on every load and hands out L1, L2... again, so its
// seals are kept per load.
const MOCK_LOAD = typeof window === "undefined" ? "" : Math.random().toString(36).slice(2, 10);
const scope = () => (MOCK ? `mock-${MOCK_LOAD}` : contractAddress() || "no-contract").toLowerCase();
const KEY = () => `found-it:seals:${scope()}`;

/** The raw stored list (a string, so it can be a stable store snapshot). */
export const sealsRaw = (): string => readItem(KEY());

export function parseSeals(raw: string): LocalSeal[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as LocalSeal[];
    return Array.isArray(list) ? list.filter((s) => s && /^[0-9a-f]{64}$/.test(String(s.digest)) && typeof s.marks === "string" && typeof s.salt === "string" && sealOf(s.marks, s.salt) === s.digest) : [];
  } catch {
    return [];
  }
}

export function saveSeal(seal: Omit<LocalSeal, "savedAt">): void {
  const list = parseSeals(sealsRaw()).filter((s) => s.digest !== seal.digest);
  list.unshift({ ...seal, savedAt: Math.floor(Date.now() / 1000) });
  writeItem(KEY(), JSON.stringify(list.slice(0, 50)));
}

/** Names the item a seal belongs to, once post_lost() said its id. */
export function attachItem(digest: string, item: string): void {
  const list = parseSeals(sealsRaw());
  const s = list.find((x) => x.digest === digest);
  if (!s || s.item === item) return;
  s.item = item;
  writeItem(KEY(), JSON.stringify(list));
}

export const sealFor = (digest: string): LocalSeal | null => parseSeals(sealsRaw()).find((s) => s.digest === digest) ?? null;
