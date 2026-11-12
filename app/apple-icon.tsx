import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#e2622b" }}>
        <div style={{ width: 106, height: 106, borderRadius: 53, border: "16px solid #fff", borderRightColor: "rgba(255,255,255,0.35)", display: "flex" }} />
      </div>
    ),
    size,
  );
}
