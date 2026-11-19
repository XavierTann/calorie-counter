export type Meal = "breakfast" | "lunch" | "dinner" | "snacks";
export const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snacks"];

export type Confidence = "high" | "medium" | "low";

export type FoodItem = {
  name: string;
  quantity: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string; // "db:<id>" | "home" | "web: <site>" | "estimate"
  confidence: Confidence;
  note?: string;
  // Low end of the likely range; kcal is the (upper-end) number that gets logged.
  kcalLow?: number;
  // How the calories were worked out: first row is the base serving, the rest are signed adjustments.
  breakdown?: { label: string; kcal: number }[];
  // Main components of a dish (e.g. soup base, lotus root, pork ribs), so you can untick what you didn't eat.
  parts?: FoodPart[];
  // How many servings of `quantity` were eaten (0.5 for "half a plate"). Foods are always known by one full serving:
  //  - a lookup result (AI, database, history) has kcal/macros for ONE serving; portion is what to start the picker on.
  //  - a logged entry has kcal/macros for what was eaten (already × portion); quantity is still the one-serving amount.
  portion?: number;
  // When logging: also star this food as a favourite.
  favourite?: boolean;
};

export type FoodPart = { name: string; kcal: number; protein: number; carbs: number; fat: number };

export type Entry = FoodItem & {
  id: number;
  date: string;
  meal: Meal;
  created_at: string;
};

export type HomeUnit = {
  id: string;
  label: string; // e.g. "Scoop of stir-fried veg"
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type BudgetMode = "target_plus_active" | "total_minus_deficit" | "fixed";

export type Settings = {
  targetKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  budgetMode: BudgetMode;
  deficit: number;
  // "auto" works the deficit out from goal weight + goal date; "manual" uses `deficit`.
  deficitMode: "auto" | "manual";
  // true: scale today's resting calories up to a whole day (Apple Watch, Garmin add them through the day).
  // false: use resting as sent (for apps that write the whole day's resting in one go).
  predictResting: boolean;
  homeUnits: HomeUnit[];
  goalWeightKg: number | null;
  goalDate: string | null;
};

export type Energy = {
  date: string;
  active: number | null;
  resting: number | null;
  total: number | null;
  source: string;
  updated_at: string;
};

// An entry in the Foods dictionary.
export type MyFood = {
  id: number;
  name: string;
  quantity: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  kind: "recorded" | "custom";
  edited: boolean;
  favourite: boolean;
  times: number;
  lastUsed: string | null;
};
