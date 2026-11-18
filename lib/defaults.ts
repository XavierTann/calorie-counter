import type { Settings } from "./types";

// Home cooking is measured in tablespoons (one heaped tbsp ≈ 20 g of a cooked dish).
// Rice stays per bowl. Calibrate by weighing a tablespoon of each dish type, then edit these in Settings.
export const DEFAULT_SETTINGS: Settings = {
  targetKcal: 2000,
  proteinG: 120,
  carbsG: 230,
  fatG: 65,
  budgetMode: "target_plus_active",
  deficit: 300,
  deficitMode: "auto",
  predictResting: true,
  goalWeightKg: null,
  goalDate: null,
  homeUnits: [
    { id: "rice-bowl", label: "Bowl of white rice (~180g)", kcal: 234, protein: 4.5, carbs: 51, fat: 0.5 },
    { id: "rice-tbsp", label: "Tbsp white rice (~15g)", kcal: 20, protein: 0.4, carbs: 4.3, fat: 0 },
    { id: "veg-tbsp", label: "Tbsp stir-fried veg (~20g)", kcal: 15, protein: 0.5, carbs: 1, fat: 1 },
    { id: "lean-meat-tbsp", label: "Tbsp lean meat dish (chicken/pork stir-fry)", kcal: 40, protein: 4, carbs: 0.5, fat: 2.5 },
    { id: "fatty-meat-tbsp", label: "Tbsp braised / fatty meat (pork belly, wings)", kcal: 70, protein: 3, carbs: 1, fat: 6 },
    { id: "fish-tbsp", label: "Tbsp steamed fish (~20g)", kcal: 25, protein: 4.5, carbs: 0, fat: 0.8 },
    { id: "egg-tbsp", label: "Tbsp egg dish (omelette, steamed egg)", kcal: 35, protein: 2.5, carbs: 0.3, fat: 2.6 },
    { id: "tofu-tbsp", label: "Tbsp tofu dish", kcal: 25, protein: 2, carbs: 1, fat: 1.5 },
    { id: "curry-tbsp", label: "Tbsp curry with gravy", kcal: 45, protein: 2.5, carbs: 1, fat: 3.5 },
    { id: "fried-piece", label: "Fried item (wing, fish cake, ngoh hiang)", kcal: 120, protein: 8, carbs: 5, fat: 8 },
    { id: "soup-bowl", label: "Bowl of soup with solids (ABC, lotus root)", kcal: 90, protein: 6, carbs: 8, fat: 3.5 },
  ],
};
