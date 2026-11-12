import { NextResponse } from "next/server";
import { recentFoods } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ items: await recentFoods() });
}
