import { ImageResponse } from "next/og";
import { BaoIcon } from "@/lib/baoIcon";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<BaoIcon px={512} />, size);
}
