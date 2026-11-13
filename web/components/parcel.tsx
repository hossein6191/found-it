// One lost item as a parcel on the shelf: brown kraft paper tied with red twine and a stencilled shelf
// number. Its state shows in the parcel itself: tied while its marks are sealed; the twine running while
// a claim is being checked; the twine cut and the note showing when a judged claim made the marks
// public; an open parcel in deep green once the reward went to its finder; pale and untied once the
// owner took the reward back.

import { cx } from "@/lib/cx";
import { shelfNumber } from "@/lib/format";
import type { ItemStatus } from "@/lib/rules";

const KRAFT = "#C8A27A";
const KRAFT_TOP = "#DDBE98";
const KRAFT_SIDE = "#A9825B";
const EDGE = "#7A5838";
const TWINE = "#B23A48";
const GREEN = "#23453B";
const GREEN_2 = "#31604F";

export const PARCEL_WORD: Record<ItemStatus, string> = {
  open: "tied up, its marks sealed",
  claimed: "a claim is being checked",
  exposed: "its twine cut, the marks public",
  returned: "opened, gone home",
  withdrawn: "untied, the reward taken back",
};

export function Parcel({ id, status, size = 200, className, title }: { id: string; status: ItemStatus | ""; size?: number; className?: string; title?: string }) {
  const st: ItemStatus = status || "open";
  const returned = st === "returned";
  const pale = st === "withdrawn";
  const front = pale ? "#DCCBB5" : KRAFT;
  const top = pale ? "#E8DCCB" : KRAFT_TOP;
  const side = pale ? "#CBB79D" : KRAFT_SIDE;
  return (
    <div className={cx("relative", st === "claimed" && "sway", className)} style={{ width: size, maxWidth: "100%", aspectRatio: "200 / 150" }}>
      <svg viewBox="0 0 200 150" className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={`${title ? title + ": " : ""}parcel ${id || "on the shelf"}, ${PARCEL_WORD[st]}`}>
        <defs>
          <pattern id={`fibre-${id}`} width="9" height="9" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="3" r="0.7" fill="rgba(255,255,255,0.22)" />
            <circle cx="6.5" cy="7" r="0.6" fill="rgba(60,35,15,0.16)" />
          </pattern>
        </defs>
        <ellipse cx="102" cy="143" rx="92" ry="6" fill="rgba(60,35,15,0.22)" />
        {returned ? (
          <>
            {/* the flaps folded up, the inside green */}
            <path d="M44 26 L184 26 L176 2 L52 2 Z" fill={KRAFT_TOP} stroke={EDGE} strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M20 48 L44 26 L26 8 L4 30 Z" fill={KRAFT_TOP} stroke={EDGE} strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M20 48 L44 26 H184 L160 48 Z" fill={GREEN} stroke={EDGE} strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M30 46 L48 30 H174" stroke={GREEN_2} strokeWidth="3" fill="none" />
          </>
        ) : (
          <path d="M20 48 L44 26 H184 L160 48 Z" fill={top} stroke={EDGE} strokeWidth="1.5" strokeLinejoin="round" />
        )}
        <path d="M160 48 L184 26 V118 L160 140 Z" fill={side} stroke={EDGE} strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="20" y="48" width="140" height="92" rx="2" fill={front} stroke={EDGE} strokeWidth="1.5" />
        <rect x="20" y="48" width="140" height="92" rx="2" fill={`url(#fibre-${id})`} />
        <path d="M20 54 H160" stroke="rgba(60,35,15,0.12)" strokeWidth="1" />

        {(st === "open" || st === "claimed") && (
          <g stroke={TWINE} strokeWidth="4" fill="none" strokeLinecap="round" className={st === "claimed" ? "twine-moving" : undefined}>
            <path d="M118 48 V140" />
            <path d="M20 96 H160 L184 74" />
            <path d="M118 48 L142 26" />
            <path d="M32 37 H172" />
          </g>
        )}
        {(st === "open" || st === "claimed") && <path d="M130 37 c-9 -11 -20 -6 -12 0 c-8 6 4 11 12 0 c9 -11 20 -6 12 0 c8 6 -4 11 -12 0 M130 37 l-6 12 M130 37 l7 11" stroke={TWINE} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />}

        {st === "exposed" && (
          <>
            {/* the twine cut: two loose ends, and the note showing at the top */}
            <path d="M118 140 V112 q3 -6 -2 -10" stroke={TWINE} strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M20 96 H68 q8 2 10 9" stroke={TWINE} strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M160 96 L184 74" stroke={TWINE} strokeWidth="4" fill="none" strokeLinecap="round" />
            <g transform="rotate(-8 100 30)">
              <rect x="74" y="14" width="56" height="30" rx="2" fill="#FFFDF6" stroke="#D3C3AA" strokeWidth="1.2" />
              <path d="M80 23 H122 M80 30 H116" stroke="#B9A88F" strokeWidth="2" strokeLinecap="round" />
            </g>
          </>
        )}

        {returned && (
          <g stroke={GREEN} strokeWidth="5" fill="none" strokeLinecap="round">
            <path d="M118 48 V140" />
            <path d="M20 96 H160 L184 74" />
          </g>
        )}
      </svg>
      <span className={cx("stencil absolute", pale && "opacity-50")} style={{ left: "15%", bottom: "11%", fontSize: Math.max(13, size * 0.15) }} aria-hidden="true">
        {id ? shelfNumber(id) : "--"}
      </span>
    </div>
  );
}
