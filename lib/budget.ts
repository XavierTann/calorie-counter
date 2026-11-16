import type { Energy, Settings } from "./types";

// How many calories you're allowed today, with the working shown line by line.

export const KCAL_PER_KG = 7700; // rough energy content of 1 kg of body fat
export const MAX_DEFICIT = 1000; // never plan to lose faster than ~1 kg a week
export const MIN_BUDGET = 1200; // never budget below this, whatever the maths says
const MIN_HOURS_TO_EXTRAPOLATE = 4; // before ~4am there's too little resting data to scale up
const COMPLETE_AFTER_HOURS = 23; // a sync after 11pm counts as the whole day

export type BudgetLine = { label: string; kcal: number | null; detail?: string; total?: boolean };
export type Budget = {
  budget: number;
  explain: string; // one short line for the dashboard
  lines: BudgetLine[]; // the full working
  burned: number | null; // estimated (or actual) calories burned for the whole day
  burnedSoFar: number | null;
};
export type WeightPoint = { date: string; kg: number };

const fmt = (n: number) => Math.round(n).toLocaleString("en-SG");
const DAY = 86_400_000;
const sgMidnight = (date: string) => Date.parse(`${date}T00:00:00+08:00`);
// SQLite datetime('now') is UTC without a zone: "2026-11-13 13:09:03".
const parseUtc = (s: string) => Date.parse(s.replace(" ", "T") + "Z");
const sgTime = (ms: number) => new Date(ms).toLocaleTimeString("en-SG", { timeZone: "Asia/Singapore", hour: "numeric", minute: "2-digit" });

// Hours into the (Singapore) day when this row was last synced.
function hoursAtSync(e: Energy) {
  return (parseUtc(e.updated_at) - sgMidnight(e.date)) / 3_600_000;
}
const isComplete = (e: Energy) => hoursAtSync(e) >= COMPLETE_AFTER_HOURS;

type Burned = { value: number; soFar: number | null; lines: BudgetLine[] };

// Estimates the whole day's burn: resting builds up evenly through the day, so a midday sync is scaled up;
// active calories are only counted once you've done them.
function estimateBurned(e: Energy | null, history: Energy[], isToday: boolean): Burned | null {
  const fullDays = history.filter((h) => h.resting !== null && isComplete(h)).slice(0, 7);
  const avgResting = fullDays.length >= 3 ? fullDays.reduce((a, h) => a + h.resting!, 0) / fullDays.length : null;
  const avgLine = (): BudgetLine => ({
    label: "Estimated resting for the whole day",
    kcal: avgResting,
    detail: `Average of your last ${fullDays.length} full days (${fullDays.map((h) => fmt(h.resting!)).join(", ")})`,
  });

  if (!e) {
    if (avgResting === null) return null;
    return { value: avgResting, soFar: null, lines: [{ label: "No Apple Health sync yet today", kcal: null }, avgLine(), { label: "Active", kcal: 0, detail: "Adds up once your activity syncs" }] };
  }

  if (e.resting === null) {
    if (e.total === null) return null;
    return { value: e.total, soFar: e.total, lines: [{ label: "Total burned (from Apple Health)", kcal: e.total, detail: "No resting/active split sent, so this isn't projected to the end of the day" }] };
  }

  const active = e.active ?? 0;
  const hours = hoursAtSync(e);
  const synced = `synced ${sgTime(parseUtc(e.updated_at))}`;
  const lines: BudgetLine[] = [];
  let resting: number;

  if (!isToday || hours >= COMPLETE_AFTER_HOURS) {
    resting = e.resting;
    lines.push({ label: "Resting (whole day)", kcal: resting, detail: `From Apple Health, ${synced}` });
  } else {
    lines.push({ label: "Resting so far", kcal: e.resting, detail: `From Apple Health, ${synced}` });
    if (avgResting !== null) {
      resting = Math.max(e.resting, avgResting);
      lines.push(avgLine());
    } else if (hours >= MIN_HOURS_TO_EXTRAPOLATE) {
      resting = (e.resting * 24) / hours;
      lines.push({
        label: "Estimated resting for the whole day",
        kcal: resting,
        detail: `${fmt(e.resting)} in ${hours.toFixed(1)} h, scaled to 24 h (${fmt(e.resting)} × 24 ÷ ${hours.toFixed(1)}). Switches to your average once you have 3 full days synced after 11pm.`,
      });
    } else {
      resting = e.resting;
      lines.push({ label: "Too early to estimate the whole day", kcal: null, detail: "Sync again after 4am" });
    }
  }
  lines.push(isToday ? { label: "Active so far", kcal: active, detail: "Workouts and steps; goes up as you move" } : { label: "Active", kcal: active });
  return { value: resting + active, soFar: e.resting + active, lines };
}

type Deficit = { value: number; lines: BudgetLine[] };

// Deficit needed to go from your current weight to your goal by the goal date.
export function autoDeficit(s: Settings, weights: WeightPoint[], today: string): Deficit | { value: null; reason: string } {
  if (s.goalWeightKg === null) return { value: null, reason: "Set a goal weight" };
  if (!s.goalDate) return { value: null, reason: "Set a goal date" };
  if (!weights.length) return { value: null, reason: "Log a weigh-in" };
  const latest = weights[weights.length - 1];
  // Average the last week of weigh-ins so one salty dinner doesn't swing the budget.
  const week = weights.filter((w) => sgMidnight(w.date) > sgMidnight(latest.date) - 7 * DAY);
  const now = week.reduce((a, w) => a + w.kg, 0) / week.length;
  const days = Math.round((sgMidnight(s.goalDate) - sgMidnight(today)) / DAY);
  if (days < 1) return { value: null, reason: "Your goal date has passed; set a new one" };
  const toLose = Math.round((now - s.goalWeightKg) * 10) / 10;
  const nowLabel = `${now.toFixed(1)} kg now${week.length > 1 ? ` (average of ${week.length} weigh-ins this week)` : ""}`;
  if (toLose <= 0) {
    return { value: 0, lines: [{ label: "Deficit", kcal: 0, detail: `${nowLabel}, already at or under your ${s.goalWeightKg} kg goal, so eating at maintenance` }] };
  }
  const needed = (toLose * KCAL_PER_KG) / days;
  const value = Math.min(needed, MAX_DEFICIT);
  const detail = `${nowLabel} → ${s.goalWeightKg} kg by ${new Date(sgMidnight(s.goalDate)).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Singapore" })}: ${toLose.toFixed(1)} kg × ${fmt(KCAL_PER_KG)} kcal = ${fmt(toLose * KCAL_PER_KG)} kcal over ${days} days = ${fmt(needed)}/day`;
  const lines: BudgetLine[] = [{ label: "Deficit (worked out from your goal)", kcal: -value, detail }];
  if (needed > MAX_DEFICIT) {
    const reach = new Date(sgMidnight(today) + Math.ceil((toLose * KCAL_PER_KG) / MAX_DEFICIT) * DAY);
    lines.push({
      label: `Capped at ${fmt(MAX_DEFICIT)}/day`,
      kcal: null,
      detail: `Faster than ~1 kg a week isn't safe. At this pace you'd reach your goal around ${reach.toLocaleDateString("en-SG", { day: "numeric", month: "short", timeZone: "Asia/Singapore" })}.`,
    });
  }
  return { value, lines };
}

export function dailyBudget(
  s: Settings,
  e: Energy | null,
  ctx: { history: Energy[]; weights: WeightPoint[]; date: string; today: string },
): Budget {
  const active = e?.active ?? 0;
  const soFar = e?.total ?? null;

  if (s.budgetMode === "target_plus_active") {
    return {
      budget: Math.round(s.targetKcal + active),
      explain: active ? `${fmt(s.targetKcal)} target + ${fmt(active)} active` : `${fmt(s.targetKcal)} target (no activity synced yet)`,
      lines: [
        { label: "Calorie target", kcal: s.targetKcal },
        { label: "Active so far (Apple Health)", kcal: active },
        { label: "Budget", kcal: s.targetKcal + active, total: true },
      ],
      burned: soFar,
      burnedSoFar: soFar,
    };
  }

  if (s.budgetMode === "total_minus_deficit") {
    const burned = estimateBurned(e, ctx.history, ctx.date === ctx.today);
    if (burned) {
      const auto = s.deficitMode === "auto" ? autoDeficit(s, ctx.weights, ctx.date) : null;
      const deficit: Deficit =
        auto && auto.value !== null
          ? (auto as Deficit)
          : {
              value: s.deficit,
              lines: [{ label: "Deficit (your fixed number)", kcal: -s.deficit, detail: auto && "reason" in auto ? `${auto.reason} to have it worked out automatically` : undefined }],
            };
      const raw = burned.value - deficit.value;
      const budget = Math.round(Math.max(MIN_BUDGET, raw));
      const lines: BudgetLine[] = [
        ...burned.lines,
        { label: ctx.date === ctx.today ? "Estimated burn today" : "Burned that day", kcal: burned.value, total: true },
        ...deficit.lines,
        ...(raw < MIN_BUDGET ? [{ label: `Raised to the ${fmt(MIN_BUDGET)} kcal minimum`, kcal: MIN_BUDGET - raw }] : []),
        { label: "Budget", kcal: budget, total: true },
      ];
      return { budget, explain: `~${fmt(burned.value)} burned − ${fmt(deficit.value)} deficit`, lines, burned: burned.value, burnedSoFar: burned.soFar };
    }
    return {
      budget: s.targetKcal,
      explain: `${fmt(s.targetKcal)} target (no Apple Health data yet)`,
      lines: [
        { label: "No Apple Health data to estimate from yet", kcal: null, detail: "Using your calorie target until the Shortcut syncs" },
        { label: "Budget", kcal: s.targetKcal, total: true },
      ],
      burned: soFar,
      burnedSoFar: soFar,
    };
  }

  return {
    budget: s.targetKcal,
    explain: `${fmt(s.targetKcal)} fixed target`,
    lines: [{ label: "Fixed target", kcal: s.targetKcal, total: true }],
    burned: soFar,
    burnedSoFar: soFar,
  };
}
