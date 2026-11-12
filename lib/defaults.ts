import type { Settings } from "./types";

// "Scoop" = one scoop with the family serving spoon. Calibrate once by
// weighing a scoop of each dish type, then edit these in Settings.
export const DEFAULT_SETTINGS: Settings = {
  targetKcal: 2000,
  proteinG: 120,
  carbsG: 230,
  fatG: 65,
  budgetMode: "target_plus_active",
  deficit: 500,
  homeUnits: [
    { id: "rice-bowl", label: "Bowl of white rice (~180g)", kcal: 234, protein: 4.5, carbs: 51, fat: 0.5 },
    { id: "veg-scoop", label: "Scoop stir-fried veg", kcal: 50, protein: 1.5, carbs: 3, fat: 3.5 },
    { id: "lean-meat-scoop", label: "Scoop lean meat dish (chicken/pork stir-fry)", kcal: 130, protein: 11, carbs: 3, fat: 8 },
    { id: "fatty-meat-scoop", label: "Scoop braised / fatty meat (pork belly, wings)", kcal: 200, protein: 9, carbs: 4, fat: 17 },
    { id: "fish-piece", label: "Piece of steamed fish (~80g)", kcal: 100, protein: 17, carbs: 1, fat: 3 },
    { id: "egg-scoop", label: "Scoop egg dish (omelette, steamed egg)", kcal: 90, protein: 6, carbs: 1, fat: 7 },
    { id: "tofu-scoop", label: "Scoop tofu dish", kcal: 80, protein: 6, carbs: 3, fat: 5 },
    { id: "curry-scoop", label: "Scoop curry with gravy", kcal: 170, protein: 10, carbs: 5, fat: 12 },
    { id: "fried-piece", label: "Fried item (wing, fish cake, ngoh hiang)", kcal: 120, protein: 8, carbs: 5, fat: 8 },
    { id: "soup-bowl", label: "Bowl of soup with solids (ABC, lotus root)", kcal: 90, protein: 6, carbs: 8, fat: 3.5 },
  ],
};
