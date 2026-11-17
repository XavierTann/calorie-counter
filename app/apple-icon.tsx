import { ImageResponse } from "next/og";
import { BaoIcon } from "@/lib/baoIcon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BaoIcon px={180} />, size);
}
