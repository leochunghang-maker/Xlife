// Barcode lookup via Open Food Facts (free, open data, ODbL licence).
// https://openfoodfacts.github.io/openfoodfacts-server/api/
import { readLocalJSON, writeLocalJSON, createId } from "./storage";
import { normalizeText } from "./food";

const OFF_FIELDS = "code,product_name,brands,serving_size,serving_quantity,nutriments";

export function isValidBarcode(code) {
  return /^\d{8,14}$/.test(String(code || "").trim());
}

export async function lookupBarcode(code, { fetchImpl = fetch } = {}) {
  const clean = String(code || "").trim();
  if (!isValidBarcode(clean)) throw new Error("Barcodes are 8–14 digits.");
  const response = await fetchImpl(`https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=${OFF_FIELDS}`);
  if (!response.ok && response.status !== 404) throw new Error("Open Food Facts is unavailable right now.");
  const body = await response.json();
  if (body.status !== 1 || !body.product) return null;
  const p = body.product;
  const n = p.nutriments || {};
  const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
  const kcal100 = num(n["energy-kcal_100g"]) ?? (num(n.energy_100g) !== null ? num(n.energy_100g) / 4.184 : null);
  return {
    code: clean,
    name: [p.product_name, p.brands?.split(",")[0]].filter(Boolean).join(" · ") || `Product ${clean}`,
    servingSize: p.serving_size || "",
    servingGrams: num(p.serving_quantity),
    per100g: {
      calories: kcal100,
      protein_g: num(n.proteins_100g),
      sugar_g: num(n.sugars_100g),
    },
    source: "Open Food Facts",
  };
}

export function nutritionForGrams(product, grams) {
  const g = Number(grams || 0);
  const scale = (value) => (value === null || value === undefined ? "" : Math.round((value * g) / 100 * 10) / 10);
  return {
    calories: product.per100g.calories === null ? "" : Math.round((product.per100g.calories * g) / 100),
    protein_g: scale(product.per100g.protein_g),
    sugar_g: scale(product.per100g.sugar_g),
  };
}

// ---- My foods (favourites) + frequent meals for quick re-adding
export const MY_FOODS_KEY = "xlife_my_foods";

export function readMyFoods() {
  const value = readLocalJSON(MY_FOODS_KEY, []);
  return Array.isArray(value) ? value : [];
}

export function saveMyFoods(list) {
  writeLocalJSON(MY_FOODS_KEY, list);
}

export function toMyFood(meal) {
  return {
    id: createId(),
    name: meal.name,
    calories: Number(meal.calories || 0),
    protein_g: Number(meal.protein_g || 0),
    sugar_g: Number(meal.sugar_g || 0),
    cost: Number(meal.cost || 0),
    restaurant_name: meal.restaurant_name || "",
  };
}

export function foodKey(meal) {
  return `${normalizeText(meal.name)}::${Number(meal.calories || 0)}`;
}

// Most frequently (then most recently) logged meals.
export function frequentMeals(history = [], limit = 6) {
  const groups = new Map();
  history.forEach((meal, index) => {
    if (!meal?.name) return;
    const key = foodKey(meal);
    const entry = groups.get(key) || { meal, count: 0, last: -1 };
    entry.count += 1;
    if (index >= entry.last) {
      entry.last = index;
      entry.meal = meal;
    }
    groups.set(key, entry);
  });
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .slice(0, limit)
    .map((entry) => ({ ...entry.meal, timesLogged: entry.count }));
}
