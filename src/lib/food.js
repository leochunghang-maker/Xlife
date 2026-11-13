import { readLocalJSON, writeLocalJSON, createId } from "./storage";

export const mealSuggestions = {
  breakfast: [
    { name: "Greek yogurt bowl with berries", calories: 380, protein_g: 28, sugar_g: 18 },
    { name: "Avocado egg toast", calories: 430, protein_g: 22, sugar_g: 4 },
    { name: "Protein oatmeal", calories: 410, protein_g: 30, sugar_g: 12 },
    { name: "Tofu scramble wrap", calories: 390, protein_g: 24, sugar_g: 5 },
  ],
  lunch: [
    { name: "Chicken quinoa salad", calories: 540, protein_g: 42, sugar_g: 7 },
    { name: "Salmon poke bowl", calories: 610, protein_g: 38, sugar_g: 10 },
    { name: "Turkey rice bowl", calories: 560, protein_g: 40, sugar_g: 6 },
    { name: "Lentil veggie bowl", calories: 500, protein_g: 25, sugar_g: 8 },
  ],
  dinner: [
    { name: "Grilled salmon with sweet potato", calories: 650, protein_g: 45, sugar_g: 9 },
    { name: "Lean beef veggie stir-fry", calories: 620, protein_g: 43, sugar_g: 8 },
    { name: "Chicken soba noodles", calories: 590, protein_g: 39, sugar_g: 7 },
    { name: "Shrimp cauliflower fried rice", calories: 480, protein_g: 36, sugar_g: 6 },
  ],
  snack: [
    { name: "Protein smoothie", calories: 280, protein_g: 25, sugar_g: 14 },
    { name: "Apple with peanut butter", calories: 240, protein_g: 8, sugar_g: 17 },
    { name: "Cottage cheese cup", calories: 190, protein_g: 22, sugar_g: 6 },
    { name: "Boiled eggs and fruit", calories: 230, protein_g: 14, sugar_g: 10 },
  ],
};
// Example restaurants shown once on first launch so the Meals tab isn't empty.
// They are flagged is_sample, labelled "Sample" in the UI, and never re-seeded
// after deletion (xlife_sample_restaurants_seeded).
export const SAMPLE_SEEDED_KEY = "xlife_sample_restaurants_seeded";
export const defaultRestaurants = [
  {
    is_sample: true,
    name: "Daily Green Bowl",
    cuisine: "Healthy bowls",
    location: "Downtown",
    source_url: "",
    notes: "Reliable protein-forward lunch spot.",
    menu_items: [
      { name: "Teriyaki Chicken Bowl", calories: 620, protein_g: 42, sugar_g: 11, cost: 13.5, rating: 4, notes: "Good post-workout option." },
      { name: "Tofu Power Salad", calories: 470, protein_g: 25, sugar_g: 8, cost: 12, rating: 4, notes: "Light but filling." },
    ],
  },
  {
    is_sample: true,
    name: "Sunny Cafe",
    cuisine: "Cafe",
    location: "Near home",
    source_url: "",
    notes: "Easy breakfast and snack picks.",
    menu_items: [
      { name: "Egg & Turkey Croissant", calories: 510, protein_g: 30, sugar_g: 5, cost: 9.75, rating: 5, notes: "Best when eaten fresh." },
      { name: "Matcha Overnight Oats", calories: 390, protein_g: 18, sugar_g: 16, cost: 8.25, rating: 4, notes: "Sweet but balanced." },
    ],
  },
];
export function createRestaurantRecord(restaurant) {
  const now = new Date().toISOString();
  return {
    id: restaurant.id || createId(),
    name: restaurant.name || "",
    cuisine: restaurant.cuisine || "",
    location: restaurant.location || "",
    phone: restaurant.phone || "",
    source_url: restaurant.source_url || "",
    rating: Number(restaurant.rating || 0),
    notes: restaurant.notes || "",
    photo_url: restaurant.photo_url || "",
    saved: Boolean(restaurant.saved),
    // Built-in examples are clearly labelled and can be deleted for good.
    is_sample: Boolean(restaurant.is_sample),
    menu_items: (restaurant.menu_items || []).map((item) => ({
      id: item.id || createId(),
      name: item.name || "",
      calories: Number(item.calories || 0),
      protein_g: Number(item.protein_g || 0),
      sugar_g: Number(item.sugar_g || 0),
      cost: Number(item.cost || 0),
      rating: Number(item.rating || 0),
      notes: item.notes || "",
      saved: Boolean(item.saved),
    })),
    createdAt: restaurant.createdAt || now,
    updatedAt: restaurant.updatedAt || now,
  };
}
export const cuisineCategories = ["Chinese", "Japanese", "Indian", "Western", "Vietnamese", "Thai", "Korean", "Italian"];
export function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}
export function suggestionKey(name, restaurantName = "") {
  return `${normalizeText(restaurantName)}::${normalizeText(name)}`;
}

function getMealCalorieTarget(mealType) {
  return {
    breakfast: 420,
    lunch: 600,
    dinner: 650,
    snack: 250,
  }[mealType] || 550;
}
export function getMealTypeForNow() {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

function getMockMenuItemForRestaurant(restaurant, mealType) {
  const cuisine = normalizeText(restaurant.cuisine);
  const isMorning = mealType === "breakfast";
  const isDinner = mealType === "dinner";
  const baseByCuisine = cuisine.includes("japanese")
    ? "Salmon rice bowl"
    : cuisine.includes("korean")
      ? "Bibimbap bowl"
      : cuisine.includes("italian")
        ? "Chicken pasta plate"
        : cuisine.includes("indian")
          ? "Tandoori chicken bowl"
          : cuisine.includes("thai")
            ? "Thai basil rice"
            : cuisine.includes("vietnamese")
              ? "Lemongrass noodle bowl"
              : cuisine.includes("chinese")
                ? "Lean beef noodle bowl"
                : "Protein power bowl";

  return {
    id: `${restaurant.id}-mock-${mealType}`,
    name: isMorning ? "Egg and avocado breakfast bowl" : isDinner ? `${baseByCuisine} date plate` : baseByCuisine,
    calories: isMorning ? 430 : isDinner ? 680 : 560,
    protein_g: isMorning ? 24 : isDinner ? 42 : 36,
    sugar_g: isMorning ? 7 : 9,
    cost: isDinner ? 18 : 13.5,
    rating: Number(restaurant.rating || 4),
    notes: restaurant.notes || "Sample estimate, not real menu data.",
    mock: true,
  };
}
export function getCuisineFallbackRestaurant(cuisine = "") {
  const normalizedCuisine = cuisine || "Western";
  return createRestaurantRecord({
    id: `mock-${normalizeText(normalizedCuisine) || "dayflow"}-pick`,
    name: `${normalizedCuisine} idea (sample)`,
    cuisine: normalizedCuisine,
    location: "Sample idea, not a real restaurant",
    rating: 4,
    notes: "Starter AI pick until your own restaurant catalog grows.",
    menu_items: [],
  });
}
export function getSmartFoodSuggestions({ mealType, meals, restaurants, rejectedSuggestions, savedSuggestions }) {
  const effectiveMealType = mealType || getMealTypeForNow();
  const allMeals = meals || [];
  const rejectedKeys = new Set((rejectedSuggestions || []).map((item) => item.key || suggestionKey(item.name, item.restaurant_name)));
  const savedKeys = new Set((savedSuggestions || []).map((item) => item.key || suggestionKey(item.name, item.restaurant_name)));
  const cuisineCounts = allMeals.reduce((counts, meal) => {
    const cuisine = normalizeText(meal.cuisine);
    if (cuisine) counts[cuisine] = (counts[cuisine] || 0) + 1;
    return counts;
  }, {});
  const recentNames = new Set(allMeals.slice(-5).map((meal) => normalizeText(meal.name)));
  const positiveWords = ["good", "favorite", "clean", "gym", "healthy"];
  const negativeWords = ["too oily", "bad", "expensive", "too sweet"];
  const targetCalories = getMealCalorieTarget(effectiveMealType);

  const restaurantCandidates = (restaurants || []).flatMap((restaurant) => {
    const menuItems = restaurant.menu_items?.length
      ? restaurant.menu_items
      : [getMockMenuItemForRestaurant(restaurant, effectiveMealType)];

    return menuItems.map((item) => ({
      id: `${restaurant.id}-${item.id}`,
      key: suggestionKey(item.name, restaurant.name),
      name: item.name,
      restaurant_name: restaurant.name,
      cuisine: restaurant.cuisine,
      calories: Number(item.calories || 0),
      protein_g: Number(item.protein_g || 0),
      sugar_g: Number(item.sugar_g || 0),
      cost: Number(item.cost || 0),
      rating: Number(item.rating || restaurant.rating || 0),
      notes: [restaurant.notes, item.notes].filter(Boolean).join(" "),
      photo_url: restaurant.photo_url || item.photo_url || "",
      saved: Boolean(restaurant.saved || item.saved),
      source: "restaurant",
      restaurant,
      item,
    }));
  });

  const mealCandidates = allMeals.map((meal, index) => ({
    id: `meal-${meal.id || meal.time || index}-${normalizeText(meal.name)}`,
    key: suggestionKey(meal.name, meal.restaurant_name),
    name: meal.name,
    restaurant_name: meal.restaurant_name || "Meal history",
    cuisine: meal.cuisine || "",
    calories: Number(meal.calories || 0),
    protein_g: Number(meal.protein_g || 0),
    sugar_g: Number(meal.sugar_g || 0),
    cost: Number(meal.cost || 0),
    rating: Number(meal.rating || 0),
    notes: meal.notes || "",
    photo_url: meal.photo_url || meal.image_url || meal.url || "",
    source: "history",
    meal,
  }));

  return [...restaurantCandidates, ...mealCandidates]
    .filter((candidate) => candidate.name)
    .map((candidate) => {
      const notes = normalizeText(candidate.notes);
      const reasons = [];
      let score = 0;

      score += candidate.rating * 3;
      if (candidate.rating >= 4) reasons.push("high rating");
      const candidateMealType = candidate.meal?.meal_type || candidate.meal?.type;
      if (candidateMealType === effectiveMealType) {
        score += 7;
        reasons.push(`fits ${effectiveMealType}`);
      }
      if (effectiveMealType === "breakfast" && normalizeText(candidate.name).match(/egg|toast|oat|breakfast|cafe/)) score += 6;
      if (effectiveMealType === "lunch" && normalizeText(candidate.name).match(/rice|noodle|bowl|salad/)) score += 6;
      if (effectiveMealType === "dinner" && normalizeText(candidate.name).match(/plate|pasta|dinner|date|salmon/)) score += 6;
      if (candidate.cuisine && cuisineCounts[normalizeText(candidate.cuisine)]) {
        score += cuisineCounts[normalizeText(candidate.cuisine)] * 3;
        reasons.push(`${candidate.cuisine} appears in your history`);
      }
      if (candidate.protein_g >= 30) {
        score += 8;
        reasons.push("strong protein");
      } else if (candidate.protein_g >= 18) {
        score += 4;
        reasons.push("solid protein");
      }
      if (candidate.sugar_g <= 8) {
        score += 5;
        reasons.push("lower sugar");
      } else if (candidate.sugar_g >= 25) {
        score -= 5;
      }
      if (candidate.calories) {
        const calorieDistance = Math.abs(candidate.calories - targetCalories);
        score += Math.max(0, 8 - calorieDistance / 60);
        if (calorieDistance <= 150) reasons.push("calories fit this meal");
      }
      if (savedKeys.has(candidate.key) || candidate.saved) {
        score += 12;
        reasons.push("saved favorite");
      }
      if (rejectedKeys.has(candidate.key)) {
        score -= 25;
      }
      if (recentNames.has(normalizeText(candidate.name))) {
        score -= 10;
      }
      positiveWords.forEach((word) => {
        if (notes.includes(word)) {
          score += 4;
          reasons.push(`note says "${word}"`);
        }
      });
      negativeWords.forEach((word) => {
        if (notes.includes(word)) score -= 6;
      });
      if (candidate.cost > 0 && candidate.cost <= 15) {
        score += 3;
        reasons.push("reasonable cost");
      } else if (candidate.cost >= 30) {
        score -= 4;
      }
      if (candidate.photo_url) score += 1;

      return {
        ...candidate,
        score,
        reason: reasons.length
          ? `Recommended because it has ${reasons.slice(0, 3).join(", ")}.`
          : "Recommended from your local meal history, restaurant catalog, ratings, nutrition, cost, and notes.",
      };
    })
    .sort((a, b) => b.score - a.score);
}

// Loads dayflow_restaurants, seeding the samples only on the very first run,
// and tags legacy (pre-flag) copies of the samples so they show as "Sample".
export function loadRestaurantCatalog() {
  const saved = readLocalJSON("dayflow_restaurants", null);
  const alreadySeeded = Boolean(localStorage.getItem(SAMPLE_SEEDED_KEY));
  if (!Array.isArray(saved)) {
    const seeded = alreadySeeded ? [] : defaultRestaurants.map(createRestaurantRecord);
    writeLocalJSON("dayflow_restaurants", seeded);
    localStorage.setItem(SAMPLE_SEEDED_KEY, new Date().toISOString());
    return seeded;
  }
  if (!alreadySeeded) localStorage.setItem(SAMPLE_SEEDED_KEY, new Date().toISOString());
  const sampleKeys = new Set(defaultRestaurants.map((r) => `${normalizeText(r.name)}::${normalizeText(r.notes)}`));
  return saved.map((restaurant) => createRestaurantRecord({
    ...restaurant,
    is_sample: restaurant.is_sample ?? sampleKeys.has(`${normalizeText(restaurant.name)}::${normalizeText(restaurant.notes)}`),
  }));
}
