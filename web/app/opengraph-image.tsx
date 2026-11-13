import { ImageResponse } from "next/og";

import { SITE_TAGLINE } from "@/lib/config";
import { GREEN, INK, KRAFT, KRAFT_SIDE, KRAFT_TOP, ROOM, TWINE, WOOD, WOOD_DARK, markDataUri } from "@/lib/mark";
import { shelfFonts } from "@/lib/og-fonts";

export const alt = "Found It: a lost-property reward that pays only the real finder. The owner seals the hidden marks; GenLayer's validators judge the finder's description.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TITLE = "Found It";
const LINE = SITE_TAGLINE;
const SUB = "The owner seals what only the holder would know. The validators judge the description.";

function Box({ x, tied, open, label }: { x: number; tied?: boolean; open?: boolean; label: string }) {
  return (
    <div style={{ position: "absolute", left: x, top: 92, width: 150, height: 150, display: "flex" }}>
      <div style={{ position: "absolute", left: 0, top: 30, width: 130, height: 104, backgroundColor: KRAFT, border: `3px solid #7A5838`, borderRadius: 4, display: "flex" }} />
      <div style={{ position: "absolute", left: 6, top: 14, width: 140, height: 18, backgroundColor: open ? GREEN : KRAFT_TOP, border: `3px solid #7A5838`, borderRadius: 3, display: "flex" }} />
      <div style={{ position: "absolute", left: 128, top: 26, width: 18, height: 104, backgroundColor: KRAFT_SIDE, border: `3px solid #7A5838`, display: "flex" }} />
      {tied && <div style={{ position: "absolute", left: 82, top: 16, width: 7, height: 118, backgroundColor: TWINE, display: "flex" }} />}
      {tied && <div style={{ position: "absolute", left: 0, top: 80, width: 132, height: 7, backgroundColor: TWINE, display: "flex" }} />}
      {open && <div style={{ position: "absolute", left: 82, top: 30, width: 8, height: 104, backgroundColor: GREEN, display: "flex" }} />}
      <div style={{ position: "absolute", left: 14, top: 96, fontSize: 26, color: "rgba(43,36,32,0.75)", fontFamily: "Martian Mono", display: "flex" }}>{label}</div>
    </div>
  );
}

// The share card: the off-white room, one plank of the shelf with three parcels on it (two tied, one
// opened and gone home), and the promise in one line.
export default async function OpenGraphImage() {
  const fonts = await shelfFonts(TITLE + LINE + SUB + "0123456789.GEN·");
  const heading = fonts.length ? "Familjen Grotesk" : "sans-serif";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", backgroundColor: ROOM, fontFamily: heading }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "56px 72px 0" }}>
          <img src={markDataUri({ size: 84 })} width={84} height={84} alt="" />
          <div style={{ fontSize: 64, fontWeight: 700, color: INK, letterSpacing: -1.5 }}>{TITLE}</div>
        </div>
        <div style={{ display: "flex", padding: "28px 72px 0", width: 760, fontSize: 44, fontWeight: 700, lineHeight: 1.1, color: INK, letterSpacing: -1 }}>{LINE}</div>
        <div style={{ display: "flex", padding: "20px 72px 0", width: 700, fontSize: 25, color: "#574B42", lineHeight: 1.35 }}>{SUB}</div>
        <div style={{ position: "absolute", right: 40, top: 150, width: 420, height: 330, display: "flex" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 16, height: 330, backgroundColor: WOOD_DARK, display: "flex" }} />
          <div style={{ position: "absolute", right: 0, top: 0, width: 16, height: 330, backgroundColor: WOOD_DARK, display: "flex" }} />
          <div style={{ position: "absolute", left: 16, top: 0, width: 388, height: 246, backgroundColor: "#EDE2D1", display: "flex" }} />
          <Box x={24} tied label="02" />
          <Box x={146} open label="03" />
          <Box x={266} tied label="04" />
          <div style={{ position: "absolute", left: 0, top: 242, width: 420, height: 26, backgroundColor: WOOD, borderBottom: `8px solid ${WOOD_DARK}`, display: "flex" }} />
        </div>
        <div style={{ position: "absolute", left: 72, bottom: 54, display: "flex", fontSize: 22, color: "#574B42", border: `2px dashed ${KRAFT_SIDE}`, borderRadius: 10, padding: "8px 16px" }}>
          GenLayer Intelligent Contract · Studio
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
