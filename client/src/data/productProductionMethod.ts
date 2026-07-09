import type { ProductComponentItem } from '../api';
import { formatCountryNumber } from '../utils/numberFormat';

export const PRODUCTION_METHOD_IMAGE_COUNT = 7;

export type ProductionMethodImage = {
  label: string;
  dataUrl: string | null;
};

export type NutritionalFactorRow = {
  factor: string;
  perRecipe: number;
  unit: string;
};

export type ProductProductionMethod = {
  methodText: string;
  images: ProductionMethodImage[];
};

const STORAGE_KEY = 'bisync.productProductionMethods';

function defaultImages(): ProductionMethodImage[] {
  return Array.from({ length: PRODUCTION_METHOD_IMAGE_COUNT }, () => ({
    label: '',
    dataUrl: null,
  }));
}

export function defaultProductionMethod(): ProductProductionMethod {
  return {
    methodText: '',
    images: defaultImages(),
  };
}

function storageKey(productKey: string): string {
  return `${STORAGE_KEY}:${productKey}`;
}

export function loadProductionMethod(productKey: string): ProductProductionMethod {
  if (typeof window === 'undefined' || !productKey) return defaultProductionMethod();
  try {
    const raw = window.localStorage.getItem(storageKey(productKey));
    if (!raw) return defaultProductionMethod();
    const parsed = JSON.parse(raw) as ProductProductionMethod;
    const images = defaultImages().map((fallback, index) => ({
      label: parsed.images?.[index]?.label?.trim() ?? fallback.label,
      dataUrl: parsed.images?.[index]?.dataUrl ?? null,
    }));
    return {
      methodText: parsed.methodText ?? '',
      images,
    };
  } catch {
    return defaultProductionMethod();
  }
}

export function saveProductionMethod(productKey: string, data: ProductProductionMethod): void {
  if (typeof window === 'undefined' || !productKey) return;
  window.localStorage.setItem(storageKey(productKey), JSON.stringify(data));
}

function componentNutritionProfile(name: string): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  sugar: number;
} {
  const text = name.toLowerCase();
  if (/beef|wagyu|lamb|pork|meat|chicken|poultry|duck|protein/.test(text)) {
    return { calories: 2.5, protein: 0.26, carbs: 0, fat: 0.15, fiber: 0, sodium: 0.7, sugar: 0 };
  }
  if (/fish|salmon|prawn|seafood|tuna/.test(text)) {
    return { calories: 1.4, protein: 0.22, carbs: 0, fat: 0.05, fiber: 0, sodium: 0.5, sugar: 0 };
  }
  if (/milk|cream|cheese|butter|dairy|yogurt/.test(text)) {
    return { calories: 1.5, protein: 0.08, carbs: 0.05, fat: 0.12, fiber: 0, sodium: 0.4, sugar: 0.04 };
  }
  if (/rice|pasta|noodle|bread|flour|grain|potato/.test(text)) {
    return { calories: 1.3, protein: 0.03, carbs: 0.28, fat: 0.01, fiber: 0.01, sodium: 0.1, sugar: 0.01 };
  }
  if (/vegetable|lettuce|spinach|tomato|onion|carrot|produce|salad/.test(text)) {
    return { calories: 0.35, protein: 0.02, carbs: 0.07, fat: 0.005, fiber: 0.02, sodium: 0.05, sugar: 0.03 };
  }
  if (/fruit|apple|berry|banana|orange|mango/.test(text)) {
    return { calories: 0.6, protein: 0.01, carbs: 0.15, fat: 0.002, fiber: 0.02, sodium: 0.01, sugar: 0.12 };
  }
  if (/oil|fat|lard/.test(text)) {
    return { calories: 8.8, protein: 0, carbs: 0, fat: 1, fiber: 0, sodium: 0, sugar: 0 };
  }
  if (/sugar|syrup|honey|sweet/.test(text)) {
    return { calories: 3.9, protein: 0, carbs: 1, fat: 0, fiber: 0, sodium: 0, sugar: 1 };
  }
  if (/salt|soy|sauce|stock/.test(text)) {
    return { calories: 0.2, protein: 0.01, carbs: 0.02, fat: 0, fiber: 0, sodium: 2.5, sugar: 0.01 };
  }
  return { calories: 1, protein: 0.05, carbs: 0.1, fat: 0.04, fiber: 0.01, sodium: 0.2, sugar: 0.02 };
}

function cookingMethodModifier(methodText: string): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  sugar: number;
} {
  const method = methodText.toLowerCase();
  const modifier = {
    calories: 1,
    protein: 1,
    carbs: 1,
    fat: 1,
    fiber: 1,
    sodium: 1,
    sugar: 1,
  };
  if (/fry|deep.?fry|sauté|saute|pan.?fry/.test(method)) {
    modifier.calories *= 1.12;
    modifier.fat *= 1.18;
  }
  if (/grill|roast|bake|oven/.test(method)) {
    modifier.fat *= 0.92;
    modifier.calories *= 0.98;
  }
  if (/steam|poach|boil/.test(method)) {
    modifier.calories *= 0.94;
    modifier.fat *= 0.88;
    modifier.fiber *= 1.03;
  }
  if (/braise|stew|simmer/.test(method)) {
    modifier.sodium *= 1.08;
    modifier.calories *= 1.02;
  }
  if (/raw|no cook|assembly/.test(method)) {
    modifier.calories *= 0.99;
    modifier.fiber *= 1.05;
  }
  if (!method.trim()) return modifier;
  return modifier;
}

export function estimateNutritionalFactors(
  components: ProductComponentItem[],
  methodText: string,
  yieldQuantity = 1,
): NutritionalFactorRow[] {
  const totals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sodium: 0,
    sugar: 0,
  };

  for (const item of components) {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;
    const profile = componentNutritionProfile(item.componentName || item.componentId);
    totals.calories += profile.calories * qty;
    totals.protein += profile.protein * qty;
    totals.carbs += profile.carbs * qty;
    totals.fat += profile.fat * qty;
    totals.fiber += profile.fiber * qty;
    totals.sodium += profile.sodium * qty;
    totals.sugar += profile.sugar * qty;
  }

  const modifier = cookingMethodModifier(methodText);
  const recipe = {
    calories: totals.calories * modifier.calories,
    protein: totals.protein * modifier.protein,
    carbs: totals.carbs * modifier.carbs,
    fat: totals.fat * modifier.fat,
    fiber: totals.fiber * modifier.fiber,
    sodium: totals.sodium * modifier.sodium,
    sugar: totals.sugar * modifier.sugar,
  };

  const servingDivisor = yieldQuantity > 0 ? yieldQuantity : 1;

  return [
    { factor: 'Energy', perRecipe: recipe.calories, unit: 'kcal' },
    { factor: 'Protein', perRecipe: recipe.protein, unit: 'g' },
    { factor: 'Carbohydrates', perRecipe: recipe.carbs, unit: 'g' },
    { factor: 'Fat', perRecipe: recipe.fat, unit: 'g' },
    { factor: 'Fibre', perRecipe: recipe.fiber, unit: 'g' },
    { factor: 'Sodium', perRecipe: recipe.sodium, unit: 'mg' },
    { factor: 'Sugar', perRecipe: recipe.sugar, unit: 'g' },
  ].map(row => ({
    ...row,
    perRecipe: row.perRecipe / servingDivisor,
  }));
}

export function formatNutritionValue(value: number, unit: string, countryCode = 'MY'): string {
  if (!Number.isFinite(value)) return '—';
  if (unit === 'kcal' || unit === 'mg') return value.toFixed(0);
  return formatCountryNumber(value, countryCode);
}

export function productKeyFromParts(productId: number | null | undefined, fallbackCode?: string): string {
  if (productId && productId > 0) return String(productId);
  if (fallbackCode?.trim()) return `draft:${fallbackCode.trim()}`;
  return '';
}
