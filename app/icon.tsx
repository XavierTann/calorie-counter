import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#e2622b" }}>
        <div style={{ width: 300, height: 300, borderRadius: 150, border: "44px solid #fff", borderRightColor: "rgba(255,255,255,0.35)", display: "flex" }} />
      </div>
    ),
    size,
  );
}
