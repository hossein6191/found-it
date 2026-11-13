// The Found It mark: a kraft-paper parcel tied with red twine, with a question mark on its front. One
// SVG source for the header logo, the app icon and the share card (as a data URI there).

export const ROOM = "#FAF6EF";
export const KRAFT = "#C8A27A";
export const KRAFT_TOP = "#DDBE98";
export const KRAFT_SIDE = "#A9825B";
export const TWINE = "#B23A48";
export const GREEN = "#23453B";
export const INK = "#2B2420";
export const EDGE = "#6E4F33";
export const WOOD = "#A9754B";
export const WOOD_DARK = "#7E5433";

export function markSvg({ size = 64 }: { size?: number } = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
<path d="M8 21 L18 12 H58 L48 21 Z" fill="${KRAFT_TOP}" stroke="${EDGE}" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M48 21 L58 12 V48 L48 57 Z" fill="${KRAFT_SIDE}" stroke="${EDGE}" stroke-width="1.6" stroke-linejoin="round"/>
<rect x="8" y="21" width="40" height="36" rx="1.5" fill="${KRAFT}" stroke="${EDGE}" stroke-width="1.6"/>
<path d="M39 21 V57 M13 16.5 H53 M39 21 L49 12 M48 39 L58 30" stroke="${TWINE}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<path d="M44 16.5 c-4 -5 -9 -3 -6 0 c-3 3 2 5 6 0 c4 -5 9 -3 6 0 c3 3 -2 5 -6 0" fill="none" stroke="${TWINE}" stroke-width="1.8" stroke-linejoin="round"/>
<path d="M17.5 32 a6.5 6.5 0 1 1 9 6 c-1.8 .8 -2.6 2 -2.6 4.2 v1.6" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="23.9" cy="50.2" r="2.5" fill="${INK}"/>
</svg>`;
}

export const markDataUri = (opts: { size?: number } = {}): string => `data:image/svg+xml;utf8,${encodeURIComponent(markSvg(opts))}`;
