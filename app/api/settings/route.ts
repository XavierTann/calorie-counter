import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/db";
import { currentUserId, unauthorized } from "@/lib/session";
import type { Settings } from "@/lib/types";

export async function GET() {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  return NextResponse.json(await getSettings(uid));
}

export async function PUT(req: Request) {
  const uid = await currentUserId();
  if (!uid) return unauthorized();
  const s = (await req.json()) as Settings;
  const clean: Settings = {
    targetKcal: Number(s.targetKcal) || 2000,
    proteinG: Number(s.proteinG) || 0,
    carbsG: Number(s.carbsG) || 0,
    fatG: Number(s.fatG) || 0,
    budgetMode: ["target_plus_active", "total_minus_deficit", "fixed"].includes(s.budgetMode) ? s.budgetMode : "target_plus_active",
    deficit: Number(s.deficit) || 0,
    homeUnits: (s.homeUnits ?? [])
      .filter((u) => u.label?.trim())
      .map((u, i) => ({
        id: u.id?.trim() || `unit-${i}`,
        label: u.label.trim(),
        kcal: Number(u.kcal) || 0,
        protein: Number(u.protein) || 0,
        carbs: Number(u.carbs) || 0,
        fat: Number(u.fat) || 0,
      })),
  };
  await saveSettings(uid, clean);
  return NextResponse.json(clean);
}
