import { ImageResponse } from "next/og";

import { ROOM, markDataUri } from "@/lib/mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The app icon: the parcel with its question mark, on the off-white of the room.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: ROOM }}>
        <img src={markDataUri({ size: 150 })} width={150} height={150} alt="" />
      </div>
    ),
    size,
  );
}
