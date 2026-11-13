// The Found It mark as inline SVG: a kraft parcel tied with red twine, a question mark on its front. The
// same drawing as lib/mark.ts, which the app icon and the share card use.

import { EDGE, INK, KRAFT, KRAFT_SIDE, KRAFT_TOP, TWINE } from "@/lib/mark";

export function Logo({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path d="M8 21 L18 12 H58 L48 21 Z" fill={KRAFT_TOP} stroke={EDGE} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M48 21 L58 12 V48 L48 57 Z" fill={KRAFT_SIDE} stroke={EDGE} strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="8" y="21" width="40" height="36" rx="1.5" fill={KRAFT} stroke={EDGE} strokeWidth="1.6" />
      <path d="M39 21 V57 M13 16.5 H53 M39 21 L49 12 M48 39 L58 30" stroke={TWINE} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M44 16.5 c-4 -5 -9 -3 -6 0 c-3 3 2 5 6 0 c4 -5 9 -3 6 0 c3 3 -2 5 -6 0" fill="none" stroke={TWINE} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M17.5 32 a6.5 6.5 0 1 1 9 6 c-1.8 .8 -2.6 2 -2.6 4.2 v1.6" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23.9" cy="50.2" r="2.5" fill={INK} />
    </svg>
  );
}
