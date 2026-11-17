import { NextResponse } from "next/server";
import { suggestFoods } from "@/lib/db";
import { todaySG } from "@/lib/date";
import { currentUserId, unauthorized } from "@/lib/session";
import { MEALS, type Meal } from "@/lib/types";

// GET /api/foods/suggest?meal=lunch → your usual foods for that meal, for the quick-pick chips.
export async function GET(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const m = new URL(req.url).searchParams.get("meal") as Meal;
  const meal = MEALS.includes(m) ? m : "lunch";
  return NextResponse.json({ meal, items: await suggestFoods(uid, meal, todaySG()) });
}
