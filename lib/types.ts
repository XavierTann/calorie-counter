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
  // How the calories were worked out: first row is the base serving, the rest are signed adjustments.
  breakdown?: { label: string; kcal: number }[];
};

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
  homeUnits: HomeUnit[];
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
  times: number;
  lastUsed: string | null;
};
