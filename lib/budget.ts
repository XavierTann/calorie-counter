import type { Energy, Settings } from "./types";

// How many calories you're allowed today.
export function dailyBudget(s: Settings, e: Energy | null): { budget: number; explain: string } {
  if (s.budgetMode === "target_plus_active") {
    const active = e?.active ?? 0;
    return {
      budget: Math.round(s.targetKcal + active),
      explain: active ? `${s.targetKcal} target + ${Math.round(active)} active` : `${s.targetKcal} target (no activity synced yet)`,
    };
  }
  if (s.budgetMode === "total_minus_deficit" && e?.total) {
    return { budget: Math.round(e.total - s.deficit), explain: `${Math.round(e.total)} burned − ${s.deficit} deficit` };
  }
  return { budget: s.targetKcal, explain: `${s.targetKcal} fixed target` };
}
