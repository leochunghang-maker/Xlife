import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Utensils,
  Camera,
  Sparkles,
  HeartPulse,
  LogOut,
  Trash2,
  Plus,
  CalendarDays,
  Dumbbell,
  Moon,
  Smile,
  NotebookPen,
  ImagePlus,
  Star,
  ChevronRight,
} from "lucide-react";
function Button({ children, className = "", variant = "default", size = "default", ...props }) {
  return (
    <button
      className={`px-4 py-2 rounded-xl font-medium transition ${
        variant === "secondary" ? "bg-zinc-200 text-zinc-900" : ""
      } ${variant === "ghost" ? "bg-transparent" : ""} ${
        variant === "default" ? "bg-orange-500 text-white" : ""
      } ${size === "icon" ? "p-2" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-3xl shadow-sm ${className}`}>{children}</div>;
}

function CardContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

const todayISO = toISODate(new Date());

const moodOptions = [
  { id: "amazing", emoji: "🤩", label: "Amazing", score: 5 },
  { id: "happy", emoji: "😊", label: "Happy", score: 4 },
  { id: "neutral", emoji: "😐", label: "Neutral", score: 3 },
  { id: "tired", emoji: "😴", label: "Tired", score: 2 },
  { id: "stressed", emoji: "😵‍💫", label: "Stressed", score: 1 },
];

const mealSuggestions = {
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

const defaultRestaurants = [
  {
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

function createRestaurantRecord(restaurant) {
  const now = new Date().toISOString();
  return {
    id: restaurant.id || crypto.randomUUID(),
    name: restaurant.name || "",
    cuisine: restaurant.cuisine || "",
    location: restaurant.location || "",
    phone: restaurant.phone || "",
    source_url: restaurant.source_url || "",
    rating: Number(restaurant.rating || 0),
    notes: restaurant.notes || "",
    photo_url: restaurant.photo_url || "",
    saved: Boolean(restaurant.saved),
    menu_items: (restaurant.menu_items || []).map((item) => ({
      id: item.id || crypto.randomUUID(),
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

const cuisineCategories = ["Chinese", "Japanese", "Indian", "Western", "Vietnamese", "Thai", "Korean", "Italian"];

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function suggestionKey(name, restaurantName = "") {
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

function getMealTypeForNow() {
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
    notes: restaurant.notes || "Mock AI estimate from restaurant profile.",
    mock: true,
  };
}

function getCuisineFallbackRestaurant(cuisine = "") {
  const normalizedCuisine = cuisine || "Western";
  return createRestaurantRecord({
    id: `mock-${normalizeText(normalizedCuisine) || "dayflow"}-pick`,
    name: `${normalizedCuisine} Dayflow Pick`,
    cuisine: normalizedCuisine,
    location: "Mock recommendation",
    rating: 4,
    notes: "Starter AI pick until your own restaurant catalog grows.",
    menu_items: [],
  });
}

function getSmartFoodSuggestions({ mealType, meals, restaurants, rejectedSuggestions, savedSuggestions }) {
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

const entertainmentNews = {
  Movies: [
    "A new romantic drama is climbing the weekend watchlist.",
    "Indie sci-fi trailers are driving the most saves this week.",
    "Cozy cinema nights are trending with dessert pairings.",
  ],
  Shows: [
    "A mystery series finale is sparking group-watch plans.",
    "Short comfort comedies are leading weeknight streaming queues.",
    "Streaming platforms are pushing spring reality-show premieres.",
  ],
  Music: [
    "A pop deluxe album drop is fueling shared playlist ideas.",
    "Acoustic live sessions are trending for slow morning routines.",
    "Festival lineup rumors are turning into summer plan inspo.",
  ],
};

const initialLog = {
  date: todayISO,
  wake_up_time: "08:15",
  sleep_quality: "good",
  sleep: {
    date: todayISO,
    source: "manual",
    bedtime: "23:45",
    wake_time: "08:15",
    duration_minutes: 510,
    sleep_quality: "good",
    sleep_stages: {
      awake: 28,
      rem: 92,
      core: 300,
      deep: 90,
    },
    last_synced_at: null,
    confirmed_awake: false,
    confirmed_at: null,
  },
  meals: [
    { type: "breakfast", name: "Greek yogurt bowl", calories: 380, protein_g: 28, sugar_g: 18, time: "09:05", rating: 5, cost: 7.5 },
    { type: "lunch", name: "Chicken quinoa salad", calories: 540, protein_g: 42, sugar_g: 7, time: "12:45", rating: 4, cost: 13.5 },
  ],
  calorie_goal: 2000,
  mood: "happy",
  notes: "Felt productive and had a balanced lunch.",
  workout: { type: "Chest", exercises: {} },
  snaps: [
    { url: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=600&auto=format&fit=crop", caption: "Healthy lunch" },
    { url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=600&auto=format&fit=crop", caption: "Evening walk" },
  ],
};

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Onboarding({ onAuthenticated }) {
  const [screen, setScreen] = useState("welcome");
  const [createdUser, setCreatedUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    birthday: "",
    gender: "",
  });
  const [signInForm, setSignInForm] = useState({ email: "", password: "" });
  const [preferences, setPreferences] = useState({
    daily_calorie_goal: "2000",
    preferred_wake_time: "07:30",
    fitness_goal: "Feel stronger",
    favorite_cuisines: [],
    relationship_mode: "Solo",
  });
  const [inviteCode, setInviteCode] = useState("");
  const [partnerCode, setPartnerCode] = useState("");

  function createAccount() {
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      setAuthError("Add your name, email, and password to create your account.");
      return;
    }

    const user = {
      id: crypto.randomUUID(),
      name: createForm.name.trim(),
      email: createForm.email.trim(),
      birthday: createForm.birthday,
      gender: createForm.gender,
      profile_photo_url: "",
      createdAt: new Date().toISOString(),
    };

    // Future Supabase Auth: replace this localStorage write with signUp() and a profiles insert.
    localStorage.setItem("dayflow_user", JSON.stringify(user));
    setCreatedUser(user);
    setAuthError("");
    setScreen("profile");
  }

  function signIn() {
    const savedUser = JSON.parse(localStorage.getItem("dayflow_user") || "null");
    if (!savedUser || normalizeText(savedUser.email) !== normalizeText(signInForm.email)) {
      setAuthError("We could not find that email yet. Create an account first or check the address.");
      return;
    }

    // Future Supabase Auth: replace this mock session with signInWithPassword().
    localStorage.setItem("dayflow_active_session", "true");
    setAuthError("");
    onAuthenticated(savedUser);
  }

  function toggleCuisine(cuisine) {
    setPreferences({
      ...preferences,
      favorite_cuisines: toggleListValue(preferences.favorite_cuisines, cuisine),
    });
  }

  function savePreferences() {
    const savedUser = createdUser || JSON.parse(localStorage.getItem("dayflow_user") || "null");
    if (!savedUser) return;

    localStorage.setItem("dayflow_user_preferences", JSON.stringify({
      ...preferences,
      daily_calorie_goal: Number(preferences.daily_calorie_goal || 0),
      createdAt: new Date().toISOString(),
    }));
    localStorage.setItem("dayflow_active_session", "true");

    if (preferences.relationship_mode === "Couple") {
      setScreen("partner");
      return;
    }

    onAuthenticated(savedUser);
  }

  function generateInviteCode() {
    const code = `DAY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const connection = {
      inviteCode: code,
      partnerName: null,
      connected: false,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem("dayflow_partner_connection", JSON.stringify(connection));
    setInviteCode(code);
  }

  function finishPartnerSetup() {
    const savedUser = createdUser || JSON.parse(localStorage.getItem("dayflow_user") || "null");
    if (partnerCode.trim()) {
      localStorage.setItem("dayflow_partner_connection", JSON.stringify({
        inviteCode: partnerCode.trim(),
        partnerName: null,
        connected: false,
        createdAt: new Date().toISOString(),
      }));
    }
    localStorage.setItem("dayflow_active_session", "true");
    onAuthenticated(savedUser);
  }

  return (
    <div className="min-h-screen bg-[hsl(30_30%_98%)] px-4 py-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-2xl flex-col justify-center">
        <div className="rounded-[2rem] bg-white p-5 shadow-sm dark:bg-zinc-900">
          {screen === "welcome" && (
            <div className="space-y-5">
              <div className="rounded-[2rem] bg-gradient-to-br from-orange-100 via-white to-teal-50 p-5 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[hsl(24_80%_58%)]">welcome to</p>
                <h1 className="mt-2 text-5xl font-black tracking-tight">Dayflow</h1>
                <p className="mt-3 text-base font-semibold text-zinc-600 dark:text-zinc-300">
                  Your daily life, health, memories, and relationship — all in one flow.
                </p>
              </div>

              <div className="grid gap-2">
                {[
                  "Track meals, mood, sleep, and workouts",
                  "Save memories and moments",
                  "Connect with your partner",
                  "Plan your days together",
                ].map((feature) => (
                  <div key={feature} className="rounded-3xl bg-[hsl(30_30%_98%)] p-4 text-sm font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {feature}
                  </div>
                ))}
              </div>

              <div className="grid gap-2">
                <Button onClick={() => { setScreen("create"); setAuthError(""); }} className="rounded-2xl bg-[hsl(24_80%_58%)] py-4 text-white">
                  Create Account
                </Button>
                <Button variant="secondary" onClick={() => { setScreen("signin"); setAuthError(""); }} className="rounded-2xl py-4">
                  Sign In
                </Button>
              </div>
            </div>
          )}

          {screen === "create" && (
            <div className="space-y-3">
              <div>
                <p className="text-3xl font-black">Create account</p>
                <p className="mt-1 text-sm text-zinc-500">Start your personal Dayflow space.</p>
              </div>
              <div className="rounded-3xl bg-[hsl(30_30%_98%)] p-4 text-center text-sm font-semibold text-zinc-500 dark:bg-zinc-800">
                Profile photo placeholder
              </div>
              <input className="field" placeholder="Name" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
              <input className="field" placeholder="Email" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
              <input className="field" placeholder="Password" type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
              <input className="field" placeholder="Birthday (optional)" type="date" value={createForm.birthday} onChange={(e) => setCreateForm({ ...createForm, birthday: e.target.value })} />
              <select className="field" value={createForm.gender} onChange={(e) => setCreateForm({ ...createForm, gender: e.target.value })}>
                <option value="">Gender (optional)</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="nonbinary">Non-binary</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
              {authError && <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-600">{authError}</p>}
              <Button onClick={createAccount} className="w-full rounded-2xl bg-[hsl(24_80%_58%)] py-4 text-white">
                Create Account
              </Button>
              <Button variant="ghost" onClick={() => setScreen("welcome")} className="w-full rounded-2xl">
                Back
              </Button>
            </div>
          )}

          {screen === "signin" && (
            <div className="space-y-3">
              <div>
                <p className="text-3xl font-black">Welcome back</p>
                <p className="mt-1 text-sm text-zinc-500">Sign in to your saved Dayflow profile.</p>
              </div>
              <input className="field" placeholder="Email" type="email" value={signInForm.email} onChange={(e) => setSignInForm({ ...signInForm, email: e.target.value })} />
              <input className="field" placeholder="Password" type="password" value={signInForm.password} onChange={(e) => setSignInForm({ ...signInForm, password: e.target.value })} />
              {authError && <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-600">{authError}</p>}
              <Button onClick={signIn} className="w-full rounded-2xl bg-[hsl(24_80%_58%)] py-4 text-white">
                Sign In
              </Button>
              <Button variant="ghost" onClick={() => setScreen("welcome")} className="w-full rounded-2xl">
                Back
              </Button>
            </div>
          )}

          {screen === "profile" && (
            <div className="space-y-3">
              <div>
                <p className="text-3xl font-black">Set your flow</p>
                <p className="mt-1 text-sm text-zinc-500">A few preferences make Dayflow feel more like you.</p>
              </div>
              <input className="field" placeholder="Daily calorie goal" type="number" value={preferences.daily_calorie_goal} onChange={(e) => setPreferences({ ...preferences, daily_calorie_goal: e.target.value })} />
              <input className="field" type="time" value={preferences.preferred_wake_time} onChange={(e) => setPreferences({ ...preferences, preferred_wake_time: e.target.value })} />
              <input className="field" placeholder="Fitness goal" value={preferences.fitness_goal} onChange={(e) => setPreferences({ ...preferences, fitness_goal: e.target.value })} />
              <div>
                <p className="mb-2 text-sm font-bold text-zinc-500">Favorite cuisines</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {cuisineCategories.map((cuisine) => (
                    <button
                      key={cuisine}
                      onClick={() => toggleCuisine(cuisine)}
                      className={classNames(
                        "rounded-2xl px-3 py-3 text-sm font-bold transition",
                        preferences.favorite_cuisines.includes(cuisine)
                          ? "bg-[hsl(24_80%_58%)] text-white"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      )}
                    >
                      {cuisine}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-bold text-zinc-500">Relationship mode</p>
                <div className="grid grid-cols-2 gap-2">
                  {["Solo", "Couple"].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setPreferences({ ...preferences, relationship_mode: mode })}
                      className={classNames(
                        "rounded-2xl px-3 py-4 text-sm font-bold",
                        preferences.relationship_mode === mode
                          ? "bg-[hsl(24_80%_58%)] text-white"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={savePreferences} className="w-full rounded-2xl bg-[hsl(24_80%_58%)] py-4 text-white">
                Continue
              </Button>
            </div>
          )}

          {screen === "partner" && (
            <div className="space-y-4">
              <div>
                <p className="text-3xl font-black">Connect with your partner</p>
                <p className="mt-1 text-sm text-zinc-500">Pairing is mocked locally for now and ready for a shared backend later.</p>
              </div>
              <Button onClick={generateInviteCode} className="w-full rounded-2xl bg-[hsl(24_80%_58%)] py-4 text-white">
                Generate invite code
              </Button>
              {inviteCode && (
                <div className="rounded-3xl bg-[hsl(160_50%_45%)]/10 p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(160_50%_45%)]">Invite code</p>
                  <p className="mt-1 text-3xl font-black">{inviteCode}</p>
                </div>
              )}
              <input className="field" placeholder="Enter partner code" value={partnerCode} onChange={(e) => setPartnerCode(e.target.value)} />
              <Button variant="secondary" onClick={finishPartnerSetup} className="w-full rounded-2xl py-4">
                Skip for now
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AppShell({ user, onLogout }) {
  const [route, setRoute] = useState("/");
  const [log, setLog] = useState(() => {
    const savedLog = localStorage.getItem("dayflow_log");
    return savedLog ? { ...initialLog, ...JSON.parse(savedLog) } : initialLog;
  });

  useEffect(() => {
    localStorage.setItem("dayflow_log", JSON.stringify(log));
  }, [log]);

  const totalCalories = useMemo(
    () => log.meals.reduce((sum, meal) => sum + Number(meal.calories || 0), 0),
    [log.meals]
  );

  const totalProtein = useMemo(
    () => log.meals.reduce((sum, meal) => sum + Number(meal.protein_g || 0), 0),
    [log.meals]
  );

  const totalSugar = useMemo(
    () => log.meals.reduce((sum, meal) => sum + Number(meal.sugar_g || 0), 0),
    [log.meals]
  );

  const pageTitle = {
    "/": "Dayflow",
    "/meals": "Meals",
    "/snaps": "Snaps",
    "/entertainment": "Fun",
    "/health": "Health",
  }[route];

  return (
    <div className="min-h-screen bg-[hsl(30_30%_98%)] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 font-sans">
      <div className="mx-auto max-w-2xl min-h-screen pb-24">
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-[hsl(30_30%_98%)]/85 dark:bg-zinc-950/80 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">
              {user?.name ? `hi, ${user.name.split(" ")[0]}` : "personal lifestyle"}
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              {pageTitle}
            </h1>
          </div>

          <Button variant="ghost" size="icon" className="rounded-2xl" onClick={onLogout}>
            <LogOut className="h-5 w-5" />
          </Button>
        </header>

        <main className="px-4 space-y-4">
          {route === "/" && (
            <Dashboard
              log={log}
              setLog={setLog}
              totals={{ totalCalories, totalProtein, totalSugar }}
              go={setRoute}
            />
          )}

          {route === "/meals" && <Meals log={log} setLog={setLog} />}
          {route === "/snaps" && <Snaps log={log} setLog={setLog} />}
          {route === "/entertainment" && (
            <Entertainment log={log} setLog={setLog} />
          )}
          {route === "/health" && <Health log={log} />}
        </main>

        <BottomNav route={route} setRoute={setRoute} />
      </div>
    </div>
  );
}

function BottomNav({ route, setRoute }) {
  const items = [
    { label: "Home", path: "/", icon: LayoutDashboard },
    { label: "Meals", path: "/meals", icon: Utensils },
    { label: "Snaps", path: "/snaps", icon: Camera },
    { label: "Fun", path: "/entertainment", icon: Sparkles },
    { label: "Health", path: "/health", icon: HeartPulse },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-3">
      <div className="mx-auto max-w-2xl grid grid-cols-5 rounded-3xl border border-white/70 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl shadow-lg">
        {items.map(({ label, path, icon: Icon }) => {
          const active = route === path;
          return (
            <button
              key={path}
              onClick={() => setRoute(path)}
              className={classNames(
                "flex flex-col items-center gap-1 py-3 text-[11px] font-semibold transition",
                active ? "text-[hsl(24_80%_58%)]" : "text-zinc-400"
              )}
            >
              <span
                className={classNames(
                  "rounded-2xl p-2 transition",
                  active ? "bg-[hsl(24_80%_58%)]/10" : ""
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SoftCard({ children, className = "" }) {
  return <Card className={classNames("border-0 shadow-sm rounded-[1.5rem] bg-white dark:bg-zinc-900", className)}><CardContent className="p-4">{children}</CardContent></Card>;
}

function SectionTitle({ icon: Icon, title, action }) {
  return <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><Icon className="h-5 w-5 text-[hsl(24_80%_58%)]" /><h2 className="font-bold">{title}</h2></div>{action}</div>;
}

const workoutTemplates = {
  Chest: [
    "Incline DB Press",
    "Incline BB Press",
    "Incline Machine",
    "Bench Press",
    "Machine Press",
    "Dips",
    "Declined Press",
  ],
  Back: [
    "Pull up",
    "Lat Pulldown",
    "Seated Row",
    "Single Arm Row",
    "Barbell Row",
    "Rear Delt Fly",
    "Chest Supported Row",
  ],
  "Shoulder/Arm": [
    "DB Shoulder Press",
    "Smith Shoulder Press",
    "Machine Shoulder Press",
    "DB Bicep Curl",
    "Machine Bicep Curl",
    "DB Hammer Curl",
    "Machine Hammer Curl",
    "Tricep Pushdown",
    "Overhead Tricep",
    "Forearm",
  ],
  "Chest/Back": [
    "Incline DB Press",
    "Incline BB Press",
    "Incline Machine",
    "Bench Press",
    "Machine Press",
    "Dips",
    "Declined Press",
    "Pull up",
    "Lat Pulldown",
    "Seated Row",
    "Single Arm Row",
    "Barbell Row",
    "Rear Delt Fly",
    "Chest Supported Row",
  ],
  Leg: [
    "Squat",
    "Smith Squat",
    "Hack Squat",
    "Hip Thrust",
    "Leg Press",
    "RDL",
    "Hip Abductor",
    "Hip Adductor",
    "Back Extension",
    "Leg Extension",
    "Leg Curl",
  ],
  Rest: [],
};

function WorkoutTracker({ log, setLog }) {
  const selectedType = log.workout?.type || "Chest";
  const exercises = workoutTemplates[selectedType] || [];
  const loggedExercises = log.workout?.exercises || {};

  function selectWorkoutType(type) {
    const savedTemplate = JSON.parse(
      localStorage.getItem(`dayflow_workout_${type}`) || "{}"
    );

    setLog({
      ...log,
      workout: {
        ...log.workout,
        type,
        exercises: savedTemplate,
      },
    });
  }

  function updateExercise(name, field, value) {
    setLog({
      ...log,
      workout: {
        ...log.workout,
        type: selectedType,
        exercises: {
          ...loggedExercises,
          [name]: {
            done: false,
            weight: "",
            reps: "",
            ...(loggedExercises[name] || {}),
            [field]: value,
          },
        },
      },
    });
  }

  function toggleDone(name) {
    const current = loggedExercises[name] || { done: false, weight: "", reps: "" };
    updateExercise(name, "done", !current.done);
  }

  return (
    <SoftCard>
      <SectionTitle icon={Dumbbell} title="Workout" />

      <div className="grid grid-cols-2 gap-2 mb-4">
        {Object.keys(workoutTemplates).map((type) => (
          <button
            key={type}
            onClick={() => selectWorkoutType(type)}
            className={classNames(
              "rounded-2xl py-3 text-sm font-semibold",
              selectedType === type
                ? "bg-[hsl(160_50%_45%)] text-white"
                : "bg-zinc-100 dark:bg-zinc-800"
            )}
          >
            {type}
          </button>
        ))}
      </div>

      {selectedType === "Rest" ? (
        <div className="rounded-3xl bg-zinc-100 dark:bg-zinc-800 p-5 text-center">
          <p className="text-3xl mb-2">😌</p>
          <p className="font-bold">Rest day</p>
          <p className="text-sm text-zinc-500 mt-1">Recovery is part of the program.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {exercises.map((exercise) => {
            const item = loggedExercises[exercise] || { done: false, weight: "", reps: "" };
            return (
              <div
                key={exercise}
                className={classNames(
                  "rounded-3xl p-3 transition",
                  item.done ? "bg-[hsl(160_50%_45%)]/10" : "bg-zinc-100 dark:bg-zinc-800"
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={() => toggleDone(exercise)}
                    className={classNames(
                      "h-7 w-7 rounded-full border flex items-center justify-center text-sm font-bold",
                      item.done
                        ? "bg-[hsl(160_50%_45%)] text-white border-[hsl(160_50%_45%)]"
                        : "bg-white dark:bg-zinc-900 border-zinc-300"
                    )}
                  >
                    {item.done ? "✓" : ""}
                  </button>
                  <p className="font-semibold flex-1">{exercise}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={item.weight}
                    onChange={(e) => updateExercise(exercise, "weight", e.target.value)}
                    placeholder="Weight"
                    className="rounded-2xl bg-white dark:bg-zinc-900 px-4 py-3 outline-none text-sm"
                  />
                  <input
                    type="number"
                    value={item.reps}
                    onChange={(e) => updateExercise(exercise, "reps", e.target.value)}
                    placeholder="Reps"
                    className="rounded-2xl bg-white dark:bg-zinc-900 px-4 py-3 outline-none text-sm"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SoftCard>
  );
}

function Gym({ log, setLog }) {
  const [savedMessage, setSavedMessage] = useState("");

  function doneWorkout() {
    const history = JSON.parse(localStorage.getItem("dayflow_workout_history") || "[]");

    const newWorkout = {
      date: todayISO,
      type: log.workout?.type,
      exercises: log.workout?.exercises || {},
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem(
      "dayflow_workout_history",
      JSON.stringify([newWorkout, ...history])
    );
    localStorage.setItem(
      `dayflow_workout_${newWorkout.type}`,
      JSON.stringify(newWorkout.exercises)
    );

    setSavedMessage("Workout saved. Next time you do this workout, your weight and reps will be remembered.");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <WorkoutTracker log={log} setLog={setLog} />

      <Button
        onClick={doneWorkout}
        className="w-full rounded-2xl py-6 bg-[hsl(24_80%_58%)] text-white"
      >
        Done Workout
      </Button>

      {savedMessage && (
        <div className="rounded-3xl bg-[hsl(160_50%_45%)]/10 p-4 text-sm text-zinc-700">
          {savedMessage}
        </div>
      )}
    </motion.div>
  );
}

function formatSleepDuration(minutes) {
  const hours = Math.floor(Number(minutes || 0) / 60);
  const mins = Number(minutes || 0) % 60;
  return `${hours}h ${mins}m`;
}

function currentTimeHHMM() {
  return new Date().toTimeString().slice(0, 5);
}

function minutesBetweenTimes(start, end) {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  return endTotal >= startTotal ? endTotal - startTotal : 1440 - startTotal + endTotal;
}

function saveSleepHistoryRecord(sleepRecord) {
  const history = JSON.parse(localStorage.getItem("dayflow_sleep_history") || "[]");
  localStorage.setItem(
    "dayflow_sleep_history",
    JSON.stringify([sleepRecord, ...history.filter((item) => item.date !== sleepRecord.date)])
  );
}

function shouldShowWakeConfirmation(sleep) {
  const now = new Date();
  const lastActiveAt = localStorage.getItem("dayflow_last_active_at");
  const snoozedAt = localStorage.getItem("dayflow_wake_prompt_snoozed_at");
  const hoursSinceActive = lastActiveAt ? (now - new Date(lastActiveAt)) / 36e5 : Infinity;
  const snoozedRecently = snoozedAt && (now - new Date(snoozedAt)) / 36e5 < 1;
  const morningOpen = now.getHours() >= 5 && now.getHours() < 12;
  const needsHealthKitConfirmation =
    sleep?.source === "apple_health" && sleep.date === todayISO && !sleep.confirmed_awake;

  if (snoozedRecently || sleep?.confirmed_awake) return false;
  return morningOpen || hoursSinceActive > 5 || needsHealthKitConfirmation;
}

async function syncSleepFromAppleHealth() {
  // TODO: connect to native HealthKit plugin.
  // Future native iOS work:
  // - Enable HealthKit capability in Xcode.
  // - Request HealthKit permission.
  // - Read HKCategoryTypeIdentifierSleepAnalysis samples.
  // - Pass sleep data back to React via Capacitor plugin.
  return {
    date: todayISO,
    source: "apple_health",
    bedtime: "23:18",
    wake_time: currentTimeHHMM(),
    duration_minutes: 504,
    sleep_quality: "good",
    sleep_stages: {
      awake: 31,
      rem: 96,
      core: 287,
      deep: 90,
    },
    last_synced_at: new Date().toISOString(),
    confirmed_awake: false,
    confirmed_at: null,
  };
}

function SleepHealthKitCard({ log, setLog, requestWakeConfirmation }) {
  const sleep = log.sleep || initialLog.sleep;
  const [manualOpen, setManualOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  function saveSleep(nextSleep) {
    const sleepRecord = {
      ...sleep,
      ...nextSleep,
      sleep_stages: {
        ...sleep.sleep_stages,
        ...(nextSleep.sleep_stages || {}),
      },
    };
    saveSleepHistoryRecord(sleepRecord);
    setLog({
      ...log,
      wake_up_time: sleepRecord.wake_time,
      sleep_quality: sleepRecord.sleep_quality || log.sleep_quality,
      sleep: sleepRecord,
    });
  }

  async function handleHealthKitSync() {
    setSyncing(true);
    const syncedSleep = await syncSleepFromAppleHealth();
    saveSleep(syncedSleep);
    requestWakeConfirmation?.();
    setSyncing(false);
  }

  function updateManualSleep(field, value) {
    const bedtime = field === "bedtime" ? value : sleep.bedtime;
    const wakeTime = field === "wake_time" ? value : sleep.wake_time;
    const duration = field === "duration_minutes" ? Number(value) : sleep.duration_minutes;

    saveSleep({
      source: "manual",
      [field]: field === "duration_minutes" ? Number(value) : value,
      bedtime,
      wake_time: wakeTime,
      duration_minutes: duration,
      sleep_quality: sleep.sleep_quality || log.sleep_quality,
      last_synced_at: sleep.last_synced_at,
    });
  }

  return (
    <SoftCard>
      <SectionTitle icon={Moon} title="Sleep" />

      <div className="mb-4 rounded-3xl bg-[hsl(160_50%_45%)]/10 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(160_50%_45%)]">
          {sleep.source === "apple_health" ? "Apple Health" : "Manual entry"}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <SummaryPill label="Duration" value={formatSleepDuration(sleep.duration_minutes)} />
          <SummaryPill label="Quality" value={log.sleep_quality || "--"} />
          <SummaryPill label="Bedtime" value={sleep.bedtime || "--"} />
          <SummaryPill label="Wake" value={sleep.wake_time || "--"} />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-2 text-center">
        {Object.entries(sleep.sleep_stages || {}).map(([stage, minutes]) => (
          <div key={stage} className="rounded-2xl bg-zinc-100 p-3 dark:bg-zinc-800">
            <p className="text-xs capitalize text-zinc-500">{stage}</p>
            <p className="font-bold">{minutes}m</p>
          </div>
        ))}
      </div>

      <p className="mb-3 rounded-2xl bg-[hsl(24_80%_58%)]/10 p-3 text-sm text-zinc-600 dark:text-zinc-300">
        Dayflow can read your Apple Health sleep data after you give permission on iPhone.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={handleHealthKitSync}
          className="rounded-2xl bg-[hsl(24_80%_58%)] py-3 text-white"
          disabled={syncing}
        >
          {syncing ? "Syncing..." : "Sync from Apple Health"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setManualOpen(!manualOpen)}
          className="rounded-2xl py-3"
        >
          Manual entry
        </Button>
      </div>

      {manualOpen && (
        <div className="mt-4 grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="time"
              value={sleep.bedtime}
              onChange={(e) => updateManualSleep("bedtime", e.target.value)}
              className="rounded-2xl bg-zinc-100 px-4 py-3 outline-none dark:bg-zinc-800"
            />
            <input
              type="time"
              value={sleep.wake_time}
              onChange={(e) => updateManualSleep("wake_time", e.target.value)}
              className="rounded-2xl bg-zinc-100 px-4 py-3 outline-none dark:bg-zinc-800"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={sleep.duration_minutes}
              onChange={(e) => updateManualSleep("duration_minutes", e.target.value)}
              className="rounded-2xl bg-zinc-100 px-4 py-3 outline-none dark:bg-zinc-800"
              placeholder="Minutes asleep"
            />
            <select
              value={log.sleep_quality}
              onChange={(e) => setLog({
                ...log,
                sleep_quality: e.target.value,
                sleep: {
                  ...sleep,
                  sleep_quality: e.target.value,
                },
              })}
              className="rounded-2xl bg-zinc-100 px-3 py-3 outline-none dark:bg-zinc-800"
            >
              {["great", "good", "okay", "poor"].map((quality) => <option key={quality}>{quality}</option>)}
            </select>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-400">
        Last synced: {sleep.last_synced_at ? new Date(sleep.last_synced_at).toLocaleString() : "Not synced yet"}
      </p>
    </SoftCard>
  );
}

function WakeConfirmationSheet({ log, setLog, onClose }) {
  const sleep = log.sleep || initialLog.sleep;
  const [editing, setEditing] = useState(false);
  const [wakeTime, setWakeTime] = useState(() => currentTimeHHMM());

  function confirmAwake() {
    const duration = minutesBetweenTimes(sleep.bedtime, wakeTime) || sleep.duration_minutes;
    const confirmedSleep = {
      ...sleep,
      date: todayISO,
      source: sleep.source || "estimated",
      wake_time: wakeTime,
      duration_minutes: duration,
      sleep_quality: sleep.sleep_quality || log.sleep_quality,
      confirmed_awake: true,
      confirmed_at: new Date().toISOString(),
    };

    saveSleepHistoryRecord(confirmedSleep);
    setLog({
      ...log,
      wake_up_time: wakeTime,
      sleep_quality: confirmedSleep.sleep_quality,
      sleep: confirmedSleep,
    });
    localStorage.removeItem("dayflow_wake_prompt_snoozed_at");
    onClose();
  }

  function dismissTemporarily() {
    localStorage.setItem("dayflow_wake_prompt_snoozed_at", new Date().toISOString());
    onClose();
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3">
      <div className="mx-auto max-w-2xl rounded-t-[2rem] rounded-b-3xl bg-white p-5 shadow-2xl dark:bg-zinc-900">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <p className="text-2xl font-bold">Are you awake?</p>
        <p className="mt-1 text-sm text-zinc-500">Confirm your wake-up time for today.</p>

        <div className="my-4 rounded-3xl bg-[hsl(24_80%_58%)]/10 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">Suggested wake time</p>
          {editing ? (
            <input
              type="time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-xl font-bold outline-none dark:bg-zinc-800"
            />
          ) : (
            <p className="mt-1 text-3xl font-bold">{wakeTime}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Button onClick={confirmAwake} className="rounded-2xl bg-[hsl(24_80%_58%)] py-4 text-white">
            Yes, I&apos;m awake
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={dismissTemporarily} className="rounded-2xl py-3">
              Not yet
            </Button>
            <Button variant="secondary" onClick={() => setEditing(true)} className="rounded-2xl py-3">
              Edit time
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ log, setLog, totals, go }) {
  const mood = moodOptions.find((m) => m.id === log.mood) || moodOptions[2];
  const progress = Math.min(100, Math.round((totals.totalCalories / log.calorie_goal) * 100));
  const [showWakeSheet, setShowWakeSheet] = useState(() => shouldShowWakeConfirmation(log.sleep || initialLog.sleep));
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const selectedDaySummary = useMemo(() => buildDailyLogSummary(log, selectedDate), [log, selectedDate]);

  useEffect(() => {
    localStorage.setItem("dayflow_last_active_at", new Date().toISOString());
  }, []);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <SummaryPill label="Sleep" value={formatSleepDuration((log.sleep || initialLog.sleep).duration_minutes)} />
          <SummaryPill label="Mood" value={mood.emoji} />
          <SummaryPill label="Kcal" value={`${totals.totalCalories}/${log.calorie_goal}`} />
        </div>

        <SleepHealthKitCard
          log={log}
          setLog={setLog}
          requestWakeConfirmation={() => setShowWakeSheet(true)}
        />

        <SoftCard>
          <SectionTitle icon={Utensils} title="Calories" action={<Button variant="ghost" size="sm" onClick={() => go('/meals')}>Meals <ChevronRight className="h-4 w-4" /></Button>} />
          <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-[hsl(24_80%_58%)]" style={{ width: `${progress}%` }} /></div>
          <p className="text-sm text-zinc-500 mt-2">{totals.totalCalories} kcal logged. {progress}% of daily goal.</p>
          <div className="mt-3 space-y-2">{log.meals.slice(-3).map((m, i) => <div key={i} className="flex justify-between text-sm"><span>{m.name}</span><span className="text-zinc-500">{m.calories} kcal</span></div>)}</div>
        </SoftCard>

        <SoftCard>
          <SectionTitle icon={CalendarDays} title="Weekly nutrition" />
          <NutritionBar label="Avg calories" value={totals.totalCalories} max={2200} unit="kcal" />
          <NutritionBar label="Protein" value={totals.totalProtein} max={150} unit="g" />
          <NutritionBar label="Sugar" value={totals.totalSugar} max={80} unit="g" />
        </SoftCard>

        <SoftCard>
          <SectionTitle icon={Smile} title="Mood" />
          <div className="grid grid-cols-5 gap-2">{moodOptions.map(m => <button key={m.id} onClick={() => setLog({ ...log, mood: m.id })} className={classNames("rounded-2xl py-3 text-2xl", log.mood === m.id ? "bg-[hsl(24_80%_58%)]" : "bg-zinc-100 dark:bg-zinc-800")}>{m.emoji}</button>)}</div>
        </SoftCard>

        <SoftCard>
          <SectionTitle icon={NotebookPen} title="Notes" />
          <textarea value={log.notes} onChange={(e) => setLog({ ...log, notes: e.target.value })} className="w-full min-h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800 px-4 py-3 outline-none" />
        </SoftCard>

        <SoftCard>
          <SectionTitle icon={Camera} title="Today's snaps" action={<Button variant="ghost" size="sm" onClick={() => go('/snaps')}>Open</Button>} />
          <div className="grid grid-cols-3 gap-2">{log.snaps.map((s, i) => <img key={i} src={s.url} className="aspect-square object-cover rounded-2xl" alt={s.caption} />)}</div>
        </SoftCard>

        <SoftCard>
          <SectionTitle icon={CalendarDays} title="Day calendar" />
          <DayCalendar selectedDate={selectedDate} setSelectedDate={setSelectedDate} log={log} />
          <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <p className="mb-3 text-lg font-black">Daily Log Summary</p>
            <DailyLogSummary summary={selectedDaySummary} />
          </div>
        </SoftCard>

        <Button className="w-full rounded-2xl py-6 bg-[hsl(24_80%_58%)] hover:bg-[hsl(24_80%_52%)]">Export last 30 days PDF</Button>
      </motion.div>

      {showWakeSheet && (
        <WakeConfirmationSheet
          log={log}
          setLog={setLog}
          onClose={() => setShowWakeSheet(false)}
        />
      )}
    </>
  );
}

function SummaryPill({ label, value }) {
  return <div className="bg-white dark:bg-zinc-900 rounded-[1.35rem] shadow-sm p-3"><p className="text-xs text-zinc-400">{label}</p><p className="font-bold text-lg truncate">{value}</p></div>;
}

function NutritionBar({ label, value, max, unit }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return <div className="mb-3"><div className="flex justify-between text-sm mb-1"><span>{label}</span><span className="text-zinc-500">{value}{unit}</span></div><div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden"><div className="h-full bg-[hsl(160_50%_45%)]" style={{ width: `${pct}%` }} /></div></div>;
}

function readLocalJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function recordsForDate(source, dateISO) {
  if (!source) return [];
  if (Array.isArray(source)) {
    return source.filter((item) => item && typeof item === "object" && (item.date || item.createdAt?.slice(0, 10) || item.taken_at?.slice(0, 10)) === dateISO);
  }
  if (source[dateISO]) return Array.isArray(source[dateISO]) ? source[dateISO] : [source[dateISO]];
  return Object.values(source).flat().filter((item) => item && typeof item === "object" && (item.date || item.createdAt?.slice(0, 10) || item.taken_at?.slice(0, 10)) === dateISO);
}

function buildDailyLogSummary(log, selectedDate) {
  const dailyLogs = readLocalJSON("dayflow_daily_logs", {});
  const sleepHistory = readLocalJSON("dayflow_sleep_history", []);
  const periodLogs = readLocalJSON("dayflow_period_logs", {});
  const workoutHistory = readLocalJSON("dayflow_workout_history", []);
  const spendingRecords = readLocalJSON("dayflow_spending", []);
  const savedLog = recordsForDate(dailyLogs, selectedDate)[0] || {};
  const isToday = selectedDate === todayISO;

  const sleep = isToday ? (log.sleep || savedLog.sleep || initialLog.sleep) : (recordsForDate(sleepHistory, selectedDate)[0] || savedLog.sleep);
  const meals = isToday ? (log.meals || []) : (savedLog.meals || recordsForDate(readLocalJSON("dayflow_meal_history", []), selectedDate));
  const workoutRecords = isToday && log.workout ? [{ date: todayISO, ...log.workout }] : recordsForDate(workoutHistory, selectedDate);
  const storedSnaps = [
    ...recordsForDate(readLocalJSON("dayflow_snaps", []), selectedDate),
    ...recordsForDate(readLocalJSON("dayflow_memories", []), selectedDate),
  ];
  const snaps = (isToday ? log.snaps : log.snaps.filter((snap) => snap.date === selectedDate || snap.taken_at?.slice(0, 10) === selectedDate))
    .concat(savedLog.snaps || [])
    .concat(storedSnaps)
    .filter((snap, index, all) => all.findIndex((item) => item.url === snap.url) === index);
  const spending = recordsForDate(spendingRecords, selectedDate);
  const cycle = periodLogs[selectedDate] || savedLog.cycle;
  const mood = isToday ? log.mood : savedLog.mood;
  const notes = isToday ? log.notes : savedLog.notes;
  const totals = meals.reduce((sum, meal) => ({
    calories: sum.calories + Number(meal.calories || 0),
    protein: sum.protein + Number(meal.protein_g || 0),
    sugar: sum.sugar + Number(meal.sugar_g || 0),
  }), { calories: 0, protein: 0, sugar: 0 });

  return {
    date: selectedDate,
    sleep,
    wakeUp: sleep?.wake_time || savedLog.wake_up_time || (isToday ? log.wake_up_time : ""),
    sleepQuality: sleep?.sleep_quality || savedLog.sleep_quality || (isToday ? log.sleep_quality : ""),
    mood,
    notes,
    meals,
    totals,
    workoutRecords,
    snaps,
    cycle,
    spending,
    hasData: Boolean(sleep || meals.length || workoutRecords.length || snaps.length || cycle || spending.length || mood || notes),
  };
}

function DayCalendar({ selectedDate, setSelectedDate, log }) {
  const [visibleMonth, setVisibleMonth] = useState(() => toLocalDate(selectedDate));
  const firstOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const firstDay = firstOfMonth.getDay();
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const calendarDays = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => toISODate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index + 1))),
  ];

  function indicatorsFor(dateISO) {
    const summary = buildDailyLogSummary(log, dateISO);
    return {
      meal: summary.meals.length > 0,
      workout: summary.workoutRecords.length > 0,
      period: Boolean(summary.cycle),
      spending: summary.spending.length > 0,
      snap: summary.snaps.length > 0,
    };
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))} className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm font-bold dark:bg-zinc-800">‹</button>
        <p className="font-bold">
          {visibleMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
        <button onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))} className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm font-bold dark:bg-zinc-800">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-zinc-400">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-sm">
        {calendarDays.map((dateISO, index) => {
          if (!dateISO) return <div key={`empty-${index}`} />;
          const isSelected = selectedDate === dateISO;
          const isToday = todayISO === dateISO;
          const indicators = indicatorsFor(dateISO);

          return (
            <button
              key={dateISO}
              onClick={() => setSelectedDate(dateISO)}
              className={classNames(
                "flex aspect-square flex-col items-center justify-center rounded-xl text-xs font-bold transition",
                isSelected ? "bg-[hsl(24_80%_58%)] text-white" : "bg-zinc-100 dark:bg-zinc-800",
                !isSelected && isToday ? "ring-2 ring-[hsl(24_80%_58%)]/30" : ""
              )}
            >
              <span>{toLocalDate(dateISO).getDate()}</span>
              <span className="mt-1 flex h-1.5 gap-0.5">
                {indicators.meal && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(24_80%_58%)]" />}
                {indicators.workout && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(160_50%_45%)]" />}
                {indicators.period && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
                {indicators.spending && <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />}
                {indicators.snap && <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DailyLogSummary({ summary }) {
  const mood = moodOptions.find((item) => item.id === summary.mood);
  const spendingTotal = summary.spending.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  if (!summary.hasData) {
    return (
      <div className="rounded-3xl bg-[hsl(160_50%_45%)]/10 p-5 text-center">
        <p className="font-bold">No logs for this day yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-zinc-500">{summary.date}</p>
      <div className="grid gap-3">
        <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
          <p className="font-bold">Sleep</p>
          <p className="mt-1 text-sm text-zinc-500">Wake-up: {summary.wakeUp || "--"} · Quality: {summary.sleepQuality || "--"}</p>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
          <p className="font-bold">Meals</p>
          <p className="mt-1 text-sm text-zinc-500">{summary.totals.calories} kcal · {summary.totals.protein}g protein · {summary.totals.sugar}g sugar</p>
          <div className="mt-2 space-y-1">{summary.meals.map((meal, index) => <p key={`${meal.name}-${index}`} className="text-sm">{meal.name} <span className="text-zinc-500">· {meal.calories || 0} kcal</span></p>)}</div>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
          <p className="font-bold">Workout</p>
          {summary.workoutRecords.length ? summary.workoutRecords.map((workout, index) => (
            <p key={index} className="mt-1 text-sm text-zinc-500">{workout.type || "Workout"} · {Object.keys(workout.exercises || {}).length} exercises</p>
          )) : <p className="mt-1 text-sm text-zinc-500">No workout logged.</p>}
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
          <p className="font-bold">Mood / Notes</p>
          <p className="mt-1 text-sm text-zinc-500">{mood ? `${mood.emoji} ${mood.label}` : "No mood"} · {summary.notes || "No notes"}</p>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
          <p className="font-bold">Snaps</p>
          {summary.snaps.length ? <div className="mt-2 grid grid-cols-3 gap-2">{summary.snaps.map((snap, index) => <img key={`${snap.url}-${index}`} src={snap.url} className="aspect-square rounded-2xl object-cover" alt={snap.caption || "Snap"} />)}</div> : <p className="mt-1 text-sm text-zinc-500">No photos.</p>}
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
          <p className="font-bold">Cycle</p>
          <p className="mt-1 text-sm capitalize text-zinc-500">{summary.cycle ? `${summary.cycle.phase || "cycle"} · ${summary.cycle.flow || "no flow"} · ${(summary.cycle.symptoms || []).join(", ") || "no symptoms"}` : "No cycle log."}</p>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
          <p className="font-bold">Spending</p>
          <p className="mt-1 text-sm text-zinc-500">${spendingTotal.toFixed(2)} total</p>
          <div className="mt-2 space-y-1">{summary.spending.map((item) => <p key={item.id} className="text-sm">{item.item_name} <span className="text-zinc-500">· ${Number(item.amount || 0).toFixed(2)}</span></p>)}</div>
        </div>
      </div>
    </div>
  );
}

function Meals({ log, setLog }) {
  const [form, setForm] = useState({ type: "breakfast", name: "", calories: "", protein_g: "", sugar_g: "", rating: 5, cost: "" });
  const [suggestions, setSuggestions] = useState([]);
  const [catalogTab, setCatalogTab] = useState("browse");
  const [restaurantSearch, setRestaurantSearch] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("");
  const [suggestionRefreshSeed, setSuggestionRefreshSeed] = useState(0);
  const [rejectedFoodSuggestions, setRejectedFoodSuggestions] = useState(() => JSON.parse(localStorage.getItem("dayflow_rejected_food_suggestions") || "[]"));
  const [savedFoodSuggestions, setSavedFoodSuggestions] = useState(() => JSON.parse(localStorage.getItem("dayflow_saved_food_suggestions") || "[]"));
  const [mealHistory, setMealHistory] = useState(() => JSON.parse(localStorage.getItem("dayflow_meal_history") || "[]"));
  const [foodPhotoPreview, setFoodPhotoPreview] = useState("");
  const [restaurantForm, setRestaurantForm] = useState({
    name: "",
    cuisine: "",
    location: "",
    phone: "",
    source_url: "",
    rating: 0,
    notes: "",
    photo_url: "",
  });
  const [restaurantCatalog, setRestaurantCatalog] = useState(() => {
    const savedRestaurants = localStorage.getItem("dayflow_restaurants");
    const seededRestaurants = savedRestaurants
      ? JSON.parse(savedRestaurants).map(createRestaurantRecord)
      : defaultRestaurants.map(createRestaurantRecord);
    if (!savedRestaurants) {
      localStorage.setItem("dayflow_restaurants", JSON.stringify(seededRestaurants));
    }
    return seededRestaurants;
  });

  useEffect(() => {
    localStorage.setItem("dayflow_restaurants", JSON.stringify(restaurantCatalog));
  }, [restaurantCatalog]);

  useEffect(() => {
    localStorage.setItem("dayflow_meal_history", JSON.stringify(mealHistory));
  }, [mealHistory]);

  useEffect(() => {
    localStorage.setItem("dayflow_rejected_food_suggestions", JSON.stringify(rejectedFoodSuggestions));
  }, [rejectedFoodSuggestions]);

  useEffect(() => {
    localStorage.setItem("dayflow_saved_food_suggestions", JSON.stringify(savedFoodSuggestions));
  }, [savedFoodSuggestions]);

  const filteredRestaurants = useMemo(() => {
    const query = restaurantSearch.trim().toLowerCase();
    return restaurantCatalog.filter((restaurant) => {
      const cuisineMatch = !selectedCuisine || restaurant.cuisine.toLowerCase().includes(selectedCuisine.toLowerCase());
      const queryMatch = !query || [restaurant.name, restaurant.cuisine, restaurant.location]
        .join(" ")
        .toLowerCase()
        .includes(query);
      const menuMatch = restaurant.menu_items.some((item) => item.name.toLowerCase().includes(query));
      return cuisineMatch && (queryMatch || menuMatch);
    });
  }, [restaurantCatalog, restaurantSearch, selectedCuisine]);

  const learningMeals = useMemo(() => [...mealHistory, ...(log.meals || [])], [log.meals, mealHistory]);

  const recommendationRestaurants = useMemo(() => {
    const defaultRecommendationRestaurants = defaultRestaurants.map(createRestaurantRecord);
    const sourceRestaurants = restaurantCatalog.length
      ? restaurantCatalog
      : defaultRecommendationRestaurants;
    const cuisineFiltered = selectedCuisine
      ? sourceRestaurants.filter((restaurant) => restaurant.cuisine.toLowerCase().includes(selectedCuisine.toLowerCase()))
      : sourceRestaurants;
    const padRestaurants = (restaurants) => {
      const seenKeys = new Set(restaurants.map((restaurant) => `${normalizeText(restaurant.name)}::${normalizeText(restaurant.cuisine)}`));
      return [
        ...restaurants,
        ...defaultRecommendationRestaurants.filter((restaurant) => !seenKeys.has(`${normalizeText(restaurant.name)}::${normalizeText(restaurant.cuisine)}`)),
      ];
    };

    if (cuisineFiltered.length >= 3) return cuisineFiltered;
    if (cuisineFiltered.length) {
      return selectedCuisine
        ? padRestaurants([getCuisineFallbackRestaurant(selectedCuisine), ...cuisineFiltered, ...sourceRestaurants])
        : padRestaurants(cuisineFiltered);
    }
    return selectedCuisine ? padRestaurants([getCuisineFallbackRestaurant(selectedCuisine), ...sourceRestaurants]) : padRestaurants(sourceRestaurants);
  }, [restaurantCatalog, selectedCuisine]);

  const generatedFoodSuggestions = useMemo(() => {
    const rankedSuggestions = getSmartFoodSuggestions({
      mealType: form.type || getMealTypeForNow(),
      meals: learningMeals,
      restaurants: recommendationRestaurants,
      rejectedSuggestions: rejectedFoodSuggestions,
      savedSuggestions: savedFoodSuggestions,
    });

    if (!rankedSuggestions.length) return [];
    const offset = suggestionRefreshSeed % rankedSuggestions.length;
    return [...rankedSuggestions.slice(offset), ...rankedSuggestions.slice(0, offset)].slice(0, 5);
  }, [form.type, learningMeals, recommendationRestaurants, rejectedFoodSuggestions, savedFoodSuggestions, suggestionRefreshSeed]);

  const smartFoodSuggestions = useMemo(() => (
    generatedFoodSuggestions.filter((suggestion) => !rejectedFoodSuggestions.some((rejected) => rejected.key === suggestion.key))
  ), [generatedFoodSuggestions, rejectedFoodSuggestions]);

  const noVisibleFoodSuggestions = generatedFoodSuggestions.length > 0 && smartFoodSuggestions.length === 0;

  function addMeal() {
    if (!form.name || !form.calories) return;
    const nextMeal = { ...form, id: crypto.randomUUID(), time: new Date().toTimeString().slice(0, 5), calories: Number(form.calories), protein_g: Number(form.protein_g || 0), sugar_g: Number(form.sugar_g || 0), cost: Number(form.cost || 0), createdAt: new Date().toISOString() };
    setLog({ ...log, meals: [...log.meals, nextMeal] });
    setMealHistory([...mealHistory, nextMeal]);
    setForm({ ...form, name: "", calories: "", protein_g: "", sugar_g: "", cost: "", photo_url: "" });
    setFoodPhotoPreview("");
  }

  function removeMeal(index) {
    setLog({ ...log, meals: log.meals.filter((_, i) => i !== index) });
  }

  function pickSuggestion(s) {
    setForm({ ...form, name: s.name, calories: s.calories, protein_g: s.protein_g, sugar_g: s.sugar_g, cost: s.cost || "", rating: s.rating || form.rating, cuisine: s.cuisine || form.cuisine, restaurant_name: s.restaurant_name || form.restaurant_name, photo_url: s.photo_url || form.photo_url });
  }

  function resetRestaurantForm() {
    setRestaurantForm({ name: "", cuisine: "", location: "", phone: "", source_url: "", rating: 0, notes: "", photo_url: "" });
  }

  function saveRestaurant() {
    if (!restaurantForm.name.trim()) return;
    const nextRestaurant = createRestaurantRecord({ ...restaurantForm, menu_items: [] });
    setRestaurantCatalog([...restaurantCatalog, nextRestaurant]);
    resetRestaurantForm();
    setCatalogTab("browse");
  }

  function deleteRestaurant(restaurantId) {
    setRestaurantCatalog(restaurantCatalog.filter((restaurant) => restaurant.id !== restaurantId));
  }

  function deleteMenuItem(restaurantId, itemId) {
    const now = new Date().toISOString();
    setRestaurantCatalog(restaurantCatalog.map((restaurant) => (
      restaurant.id === restaurantId
        ? { ...restaurant, menu_items: restaurant.menu_items.filter((item) => item.id !== itemId), updatedAt: now }
        : restaurant
    )));
  }

  function addMenuItemToMeal(item, restaurant = {}) {
    setForm({
      ...form,
      name: item.name,
      calories: item.calories,
      protein_g: item.protein_g,
      sugar_g: item.sugar_g,
      cost: item.cost,
      rating: item.rating || form.rating,
      cuisine: restaurant.cuisine || form.cuisine,
      restaurant_name: restaurant.name || form.restaurant_name,
      photo_url: restaurant.photo_url || item.photo_url || form.photo_url,
    });
  }

  function rejectCatalogSuggestion(suggestion) {
    if (!suggestion) return;
    const rejected = {
      id: suggestion.id,
      key: suggestion.key,
      name: suggestion.name,
      restaurant_name: suggestion.restaurant_name,
      cuisine: suggestion.cuisine,
      rejectedAt: new Date().toISOString(),
    };
    setRejectedFoodSuggestions([...rejectedFoodSuggestions.filter((item) => item.key !== rejected.key), rejected]);
  }

  function saveCatalogSuggestion(suggestion) {
    if (!suggestion) return;
    const now = new Date().toISOString();
    const saved = {
      id: suggestion.id,
      key: suggestion.key,
      name: suggestion.name,
      restaurant_name: suggestion.restaurant_name,
      cuisine: suggestion.cuisine,
      savedAt: now,
    };
    const matchingRestaurant = restaurantCatalog.find((restaurant) => (
      restaurant.id === suggestion.restaurant?.id || restaurant.name === suggestion.restaurant_name
    ));
    const savedMenuItem = {
      id: suggestion.item?.id || crypto.randomUUID(),
      name: suggestion.name,
      calories: Number(suggestion.calories || 0),
      protein_g: Number(suggestion.protein_g || 0),
      sugar_g: Number(suggestion.sugar_g || 0),
      cost: Number(suggestion.cost || 0),
      rating: Number(suggestion.rating || 0),
      notes: suggestion.notes || suggestion.reason || "",
      saved: true,
    };

    setSavedFoodSuggestions([...savedFoodSuggestions.filter((item) => item.key !== saved.key), saved]);
    if (matchingRestaurant) {
      setRestaurantCatalog(restaurantCatalog.map((restaurant) => (
        restaurant.id === matchingRestaurant.id
          ? {
              ...restaurant,
              saved: true,
              updatedAt: now,
              menu_items: restaurant.menu_items.some((item) => item.id === savedMenuItem.id || item.name === savedMenuItem.name)
                ? restaurant.menu_items.map((item) => (
                    item.id === savedMenuItem.id || item.name === savedMenuItem.name ? { ...item, saved: true } : item
                  ))
                : [...restaurant.menu_items, savedMenuItem],
            }
          : restaurant
      )));
      return;
    }

    setRestaurantCatalog([
      ...restaurantCatalog,
      createRestaurantRecord({
        name: suggestion.restaurant_name || suggestion.name,
        cuisine: suggestion.cuisine || "",
        location: suggestion.restaurant?.location || "",
        rating: Number(suggestion.rating || 0),
        notes: suggestion.reason || suggestion.notes || "",
        photo_url: suggestion.photo_url || "",
        saved: true,
        menu_items: [savedMenuItem],
      }),
    ]);
  }

  function addCatalogSuggestionToMeal(suggestion) {
    if (!suggestion) return;
    pickSuggestion(suggestion);
    setMealHistory([
      ...mealHistory,
      {
        ...suggestion,
        type: form.type,
        meal_type: form.type,
        addedFromSuggestionAt: new Date().toISOString(),
      },
    ]);
  }

  function refreshFoodSuggestions() {
    setSuggestionRefreshSeed((seed) => seed + 1);
  }

  function isSuggestionSaved(suggestion) {
    return Boolean(suggestion?.saved || savedFoodSuggestions.some((item) => item.key === suggestion?.key));
  }

  function handleRestaurantPhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setRestaurantForm({ ...restaurantForm, photo_url: String(reader.result) });
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function handleFoodPhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const photoUrl = String(reader.result);
      setFoodPhotoPreview(photoUrl);
      setForm({ ...form, photo_url: photoUrl });
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
    <SoftCard>
      <SectionTitle icon={Utensils} title="Log a meal" />
      <div className="grid grid-cols-4 gap-2 mb-3">{['breakfast','lunch','dinner','snack'].map(t => <button key={t} onClick={() => setForm({ ...form, type: t })} className={classNames("rounded-2xl py-2 text-xs capitalize", form.type === t ? "bg-[hsl(24_80%_58%)] text-white" : "bg-zinc-100 dark:bg-zinc-800")}>{t}</button>)}</div>
      <input className="field" placeholder="Meal name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <div className="grid grid-cols-3 gap-2"><input className="field" placeholder="Calories" type="number" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} /><input className="field" placeholder="Protein g" type="number" value={form.protein_g} onChange={(e) => setForm({ ...form, protein_g: e.target.value })} /><input className="field" placeholder="Sugar g" type="number" value={form.sugar_g} onChange={(e) => setForm({ ...form, sugar_g: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-2"><input className="field" placeholder="Cost" type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /><select className="field" value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n} stars</option>)}</select></div>
      <div className="flex gap-2 mt-2"><Button onClick={addMeal} className="flex-1 rounded-2xl bg-[hsl(24_80%_58%)]"><Plus className="h-4 w-4 mr-1" /> Add</Button><Button variant="secondary" className="rounded-2xl" onClick={() => setSuggestions(smartFoodSuggestions.length ? smartFoodSuggestions.slice(0, 4) : mealSuggestions[form.type].map((item) => ({ ...item, key: suggestionKey(item.name), reason: "Starter idea until Dayflow learns more from your meals." })))}>AI ideas</Button></div>
      {suggestions.length > 0 && <div className="mt-3 grid gap-2">{suggestions.map((s) => <button key={s.key || s.name} onClick={() => pickSuggestion(s)} className="text-left bg-zinc-100 dark:bg-zinc-800 rounded-2xl p-3 text-sm"><b>{s.name}</b><p className="text-zinc-500">{s.calories} kcal · {s.protein_g}g protein · {s.reason}</p></button>)}</div>}
    </SoftCard>

    <SoftCard>
      <SectionTitle icon={Sparkles} title="Restaurant catalog" />

      <div className="mb-4 grid grid-cols-2 rounded-3xl bg-zinc-100 p-1 dark:bg-zinc-800">
        {[
          { id: "browse", label: "Browse" },
          { id: "restaurant", label: "Add Restaurant" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCatalogTab(tab.id)}
            className={classNames(
              "rounded-3xl px-2 py-3 text-xs font-bold transition",
              catalogTab === tab.id
                ? "bg-[hsl(24_80%_58%)] text-white shadow-sm"
                : "text-zinc-500"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {catalogTab === "browse" && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-[hsl(30_30%_98%)] p-4 dark:bg-zinc-800">
            <p className="font-bold">Find nearby restaurants</p>
            <input
              className="field mt-3"
              placeholder="Location, restaurant, or menu item"
              value={restaurantSearch}
              onChange={(e) => setRestaurantSearch(e.target.value)}
            />
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {cuisineCategories.map((cuisine) => (
                <button
                  key={cuisine}
                  onClick={() => {
                    setSelectedCuisine(selectedCuisine === cuisine ? "" : cuisine);
                  }}
                  className={classNames(
                    "rounded-2xl px-3 py-3 text-sm font-bold transition",
                    selectedCuisine === cuisine
                      ? "bg-[hsl(24_80%_58%)] text-white shadow-sm"
                      : "bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                  )}
                >
                  {cuisine}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-[hsl(160_50%_45%)]">AI pick</p>
                <p className="text-lg font-black">Recommended for you</p>
              </div>
              <Button variant="secondary" onClick={refreshFoodSuggestions} className="rounded-2xl px-3 py-2 text-xs">
                Refresh suggestions
              </Button>
            </div>
            <p className="mb-3 text-sm text-zinc-500">
              Suggestions improve as you log meals, rate them, reject them, and save favorites.
            </p>

            {noVisibleFoodSuggestions || smartFoodSuggestions.length === 0 ? (
              <div className="rounded-3xl bg-[hsl(160_50%_45%)]/10 p-5 text-center">
                <p className="font-bold">No more suggestions right now.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {smartFoodSuggestions.slice(0, 5).map((suggestion) => (
                  <div key={suggestion.key} className="rounded-3xl bg-[hsl(30_30%_98%)] p-3 shadow-sm dark:bg-zinc-800">
                    {suggestion.photo_url ? (
                      <img
                        src={suggestion.photo_url}
                        alt=""
                        className="h-36 w-full rounded-3xl object-cover"
                      />
                    ) : (
                      <div className="flex h-36 items-center justify-center rounded-3xl bg-[hsl(160_50%_45%)]/10 text-sm font-bold text-[hsl(160_50%_45%)]">
                        AI menu pick
                      </div>
                    )}

                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black">{suggestion.restaurant_name}</p>
                        <p className="text-sm text-zinc-500">
                          {suggestion.cuisine || "Cuisine"} · {suggestion.source === "history" ? "From meal history" : suggestion.restaurant?.location || "Local pick"}
                        </p>
                      </div>
                      {isSuggestionSaved(suggestion) && (
                        <span className="shrink-0 rounded-full bg-[hsl(160_50%_45%)]/10 px-3 py-1 text-xs font-bold text-[hsl(160_50%_45%)]">Saved</span>
                      )}
                    </div>

                    <div className="mt-3 rounded-3xl bg-white p-3 dark:bg-zinc-900">
                      <p className="font-bold">{suggestion.name}</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {Number(suggestion.calories || 0)} kcal · {Number(suggestion.protein_g || 0)}g protein · {Number(suggestion.sugar_g || 0)}g sugar
                      </p>
                      <p className="text-sm text-zinc-500">
                        ${Number(suggestion.cost || 0).toFixed(2)} · {Number(suggestion.rating || 0)} stars
                      </p>
                    </div>

                    <p className="mt-3 rounded-3xl bg-[hsl(160_50%_45%)]/10 p-3 text-sm text-zinc-600 dark:text-zinc-300">
                      {suggestion.reason}
                    </p>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Button onClick={() => addCatalogSuggestionToMeal(suggestion)} className="rounded-2xl bg-[hsl(24_80%_58%)] px-2 text-xs text-white">
                        Add to Meal
                      </Button>
                      <Button onClick={() => saveCatalogSuggestion(suggestion)} className="rounded-2xl bg-[hsl(160_50%_45%)] px-2 text-xs text-white">
                        Save Restaurant
                      </Button>
                      <Button variant="secondary" onClick={() => rejectCatalogSuggestion(suggestion)} className="rounded-2xl px-2 text-xs">
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {filteredRestaurants.length === 0 ? (
            <div className="rounded-3xl bg-[hsl(160_50%_45%)]/10 p-5 text-center">
              <p className="font-bold">No matches yet</p>
              <p className="mt-1 text-sm text-zinc-500">Try another search or add a new restaurant.</p>
            </div>
          ) : (
            filteredRestaurants.map((restaurant) => (
              <div key={restaurant.id} className="rounded-3xl bg-[hsl(30_30%_98%)] p-4 shadow-sm dark:bg-zinc-800">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{restaurant.name}</p>
                    <p className="text-sm text-zinc-500">{restaurant.cuisine || "Cuisine"} · {restaurant.location || "Location"}</p>
                    {restaurant.notes && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{restaurant.notes}</p>}
                  </div>
                  <Button variant="secondary" size="icon" onClick={() => deleteRestaurant(restaurant.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {restaurant.menu_items.length === 0 ? (
                    <p className="rounded-2xl bg-white p-3 text-sm text-zinc-500 dark:bg-zinc-900">No menu items yet.</p>
                  ) : (
                    restaurant.menu_items.map((item) => (
                      <div key={item.id} className="rounded-3xl bg-white p-3 dark:bg-zinc-900">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-xs text-zinc-500">
                              {item.calories} kcal · {item.protein_g}g protein · {item.sugar_g}g sugar
                            </p>
                            <p className="text-xs text-zinc-500">
                              ${Number(item.cost || 0).toFixed(2)} · {item.rating || 0} stars
                            </p>
                            {item.notes && <p className="mt-1 text-xs text-zinc-500">{item.notes}</p>}
                          </div>
                          <Button variant="secondary" size="icon" onClick={() => deleteMenuItem(restaurant.id, item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button
                          onClick={() => addMenuItemToMeal(item, restaurant)}
                          className="mt-3 w-full rounded-2xl bg-[hsl(24_80%_58%)] text-white"
                        >
                          Add to meal
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {catalogTab === "restaurant" && (
        <div className="space-y-4">
          <input className="field" placeholder="Restaurant name" value={restaurantForm.name} onChange={(e) => setRestaurantForm({ ...restaurantForm, name: e.target.value })} />
          <div>
            <p className="mb-2 text-sm font-bold text-zinc-500">Cuisine</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {cuisineCategories.map((cuisine) => (
                <button
                  key={cuisine}
                  onClick={() => setRestaurantForm({ ...restaurantForm, cuisine })}
                  className={classNames(
                    "rounded-2xl px-3 py-3 text-sm font-bold transition",
                    restaurantForm.cuisine === cuisine
                      ? "bg-[hsl(24_80%_58%)] text-white shadow-sm"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  )}
                >
                  {cuisine}
                </button>
              ))}
            </div>
          </div>
          <input className="field" placeholder="Location" value={restaurantForm.location} onChange={(e) => setRestaurantForm({ ...restaurantForm, location: e.target.value })} />
          <input className="field" placeholder="Phone / takeaway number" value={restaurantForm.phone} onChange={(e) => setRestaurantForm({ ...restaurantForm, phone: e.target.value })} />
          <input className="field" placeholder="Source URL" value={restaurantForm.source_url} onChange={(e) => setRestaurantForm({ ...restaurantForm, source_url: e.target.value })} />
          <select className="field" value={restaurantForm.rating} onChange={(e) => setRestaurantForm({ ...restaurantForm, rating: Number(e.target.value) })}>
            {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n} stars</option>)}
          </select>
          <textarea className="min-h-24 w-full rounded-2xl bg-zinc-100 px-4 py-3 outline-none dark:bg-zinc-800" placeholder="Notes" value={restaurantForm.notes} onChange={(e) => setRestaurantForm({ ...restaurantForm, notes: e.target.value })} />
          <label className="block rounded-3xl border border-dashed border-zinc-200 bg-[hsl(30_30%_98%)] p-4 text-center text-sm font-semibold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">
            Upload restaurant/menu photo
            <input type="file" accept="image/*" className="hidden" onChange={handleRestaurantPhotoUpload} />
          </label>
          {restaurantForm.photo_url && <img src={restaurantForm.photo_url} alt="" className="h-36 w-full rounded-3xl object-cover" />}

          <Button onClick={saveRestaurant} className="w-full rounded-2xl bg-[hsl(24_80%_58%)] py-3 text-white">Save Restaurant</Button>
        </div>
      )}
    </SoftCard>

    <SoftCard>
      <SectionTitle icon={ImagePlus} title="Photo calorie scanner" />
      <label className="block rounded-2xl border-2 border-dashed border-zinc-200 p-6 text-center text-sm font-semibold text-zinc-500 dark:border-zinc-700">
        Upload food photo — AI estimate will connect later
        <input type="file" accept="image/*" className="hidden" onChange={handleFoodPhotoUpload} />
      </label>
      {foodPhotoPreview && (
        <img src={foodPhotoPreview} alt="" className="mt-3 h-40 w-full rounded-3xl object-cover" />
      )}
    </SoftCard>

    <SoftCard>
      <SectionTitle icon={Star} title="Today's meals" />
      <div className="space-y-2">{log.meals.map((meal, i) => <div key={i} className="flex items-center justify-between rounded-2xl bg-zinc-100 dark:bg-zinc-800 p-3"><div><p className="font-semibold">{meal.name}</p><p className="text-xs text-zinc-500 capitalize">{meal.type} · {meal.calories} kcal</p></div><div className="flex gap-2"><Button variant="secondary" size="icon" onClick={() => removeMeal(i)}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>
    </SoftCard>
  </motion.div>;
}

function Snaps({ log, setLog }) {
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [cameraFacing, setCameraFacing] = useState("rear");
  const [captureMode, setCaptureMode] = useState("memory");
  const [foodForm, setFoodForm] = useState({
    meal_type: "lunch",
    name: "",
    calories: "",
    protein_g: "",
    sugar_g: "",
    cost: "",
    rating: 0,
    notes: "",
  });
  const [spendingForm, setSpendingForm] = useState({
    item_name: "",
    amount: "",
    category: "Food",
    merchant: "",
    notes: "",
  });
  const [spendingSavedMessage, setSpendingSavedMessage] = useState("");
  const [spendingRecords, setSpendingRecords] = useState(() => JSON.parse(localStorage.getItem("dayflow_spending") || "[]"));
  const todaySnaps = log.snaps.filter((snap) => (!snap.date || snap.date === todayISO) && (!snap.type || snap.type === "memory"));
  const todaySpendingTotal = spendingRecords
    .filter((record) => record.date === todayISO)
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);

  useEffect(() => {
    localStorage.setItem("dayflow_spending", JSON.stringify(spendingRecords));
  }, [spendingRecords]);

  function captureSnap() {
    const captured = cameraFacing === "rear"
      ? "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=900&auto=format&fit=crop"
      : "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=900&auto=format&fit=crop";
    setPreview(captured);
    resetCaptureForms();
  }

  function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPreview(String(reader.result));
      resetCaptureForms();
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function resetCaptureForms() {
    setCaption("");
    setCaptureMode("memory");
    setFoodForm({ meal_type: "lunch", name: "", calories: "", protein_g: "", sugar_g: "", cost: "", rating: 0, notes: "" });
    setSpendingForm({ item_name: "", amount: "", category: "Food", merchant: "", notes: "" });
    setSpendingSavedMessage("");
  }

  function clearCapture() {
    setPreview("");
    resetCaptureForms();
  }

  function saveMemory() {
    if (!preview) return;
    setLog({
      ...log,
      snaps: [
        ...log.snaps,
        {
          url: preview,
          caption: caption || "A Dayflow moment",
          date: todayISO,
          taken_at: new Date().toISOString(),
          type: "memory",
        },
      ],
    });
    clearCapture();
  }

  function estimateFoodFromPhoto() {
    const estimate = {
      name: "Grilled chicken rice bowl",
      calories: 560,
      protein_g: 42,
      sugar_g: 8,
    };
    setFoodForm({ ...foodForm, ...estimate });
    return estimate;
  }

  function selectCaptureMode(mode) {
    setCaptureMode(mode);
    if (mode === "food" && !foodForm.name) {
      setFoodForm({
        ...foodForm,
        name: "Grilled chicken rice bowl",
        calories: 560,
        protein_g: 42,
        sugar_g: 8,
      });
    }
  }

  function saveFoodMeal() {
    if (!preview) return;
    const estimate = foodForm.name
      ? foodForm
      : { ...foodForm, name: "Grilled chicken rice bowl", calories: 560, protein_g: 42, sugar_g: 8 };
    const nextMeal = {
      type: "food",
      image_url: preview,
      photo_url: preview,
      meal_type: estimate.meal_type,
      name: estimate.name,
      calories: Number(estimate.calories || 0),
      protein_g: Number(estimate.protein_g || 0),
      sugar_g: Number(estimate.sugar_g || 0),
      cost: Number(estimate.cost || 0),
      rating: Number(estimate.rating || 1),
      notes: estimate.notes,
      time: new Date().toTimeString().slice(0, 5),
    };
    const history = JSON.parse(localStorage.getItem("dayflow_meal_history") || "[]");

    setLog({ ...log, meals: [...log.meals, nextMeal] });
    localStorage.setItem("dayflow_meal_history", JSON.stringify([...history, { ...nextMeal, createdAt: new Date().toISOString() }]));
    clearCapture();
  }

  function saveSpending() {
    if (!preview || !spendingForm.item_name.trim() || !spendingForm.amount) return;
    const nextSpending = {
      id: crypto.randomUUID(),
      date: todayISO,
      image_url: preview,
      item_name: spendingForm.item_name,
      amount: Number(spendingForm.amount || 0),
      category: spendingForm.category,
      merchant: spendingForm.merchant,
      notes: spendingForm.notes,
      createdAt: new Date().toISOString(),
    };

    setSpendingRecords([...spendingRecords, nextSpending]);
    setSpendingSavedMessage(`Saved. You spent $${nextSpending.amount.toFixed(2)} on ${nextSpending.item_name}.`);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="-mx-4 -mt-2 min-h-[calc(100vh-8.5rem)] bg-zinc-950 px-4 pb-6 pt-4 text-white"
    >
      <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-md flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold backdrop-blur-xl">
            🔥 {todaySnaps.length} snaps today
          </div>
          <button
            onClick={() => setCameraFacing(cameraFacing === "rear" ? "front" : "rear")}
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold backdrop-blur-xl transition hover:bg-white/20"
          >
            {cameraFacing === "rear" ? "Rear" : "Front"}
          </button>
        </div>

        <div className="relative my-5 overflow-hidden rounded-[2rem] bg-black shadow-2xl ring-1 ring-white/10">
          <div className="aspect-[9/14] w-full">
            {preview ? (
              <img src={preview} alt="Snap preview" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-zinc-900 via-zinc-950 to-black px-8 text-center">
                <div className="mb-4 rounded-full bg-white/10 p-5">
                  <Camera className="h-10 w-10 text-white" />
                </div>
                <p className="text-lg font-bold">Ready for a snap</p>
                <p className="mt-2 text-sm text-zinc-400">
                  Capture a moment or upload from your gallery.
                </p>
              </div>
            )}
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/65 to-transparent" />
        </div>

        {preview ? (
          <div className="space-y-3 rounded-[2rem] bg-white p-4 text-zinc-900 shadow-2xl dark:bg-zinc-900 dark:text-white">
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "memory", label: "Save Memory", color: "bg-[hsl(24_80%_58%)]" },
                { id: "food", label: "Mark Food", color: "bg-[hsl(160_50%_45%)]" },
                { id: "spending", label: "Track Spending", color: "bg-purple-500" },
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => selectCaptureMode(option.id)}
                  className={classNames(
                    "rounded-3xl px-2 py-3 text-xs font-bold transition",
                    captureMode === option.id
                      ? `${option.color} text-white shadow-sm`
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {captureMode === "memory" && (
              <div className="space-y-3">
                <input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full rounded-3xl bg-zinc-100 px-5 py-4 text-zinc-900 outline-none placeholder:text-zinc-400 dark:bg-zinc-800 dark:text-white"
                  placeholder="Add a caption"
                />
                <Button onClick={saveMemory} className="w-full rounded-3xl bg-[hsl(24_80%_58%)] py-4 text-white">
                  Save as Memory
                </Button>
              </div>
            )}

            {captureMode === "food" && (
              <div className="space-y-3">
                <select className="field" value={foodForm.meal_type} onChange={(e) => setFoodForm({ ...foodForm, meal_type: e.target.value })}>
                  {["breakfast", "lunch", "dinner", "snack"].map((type) => <option key={type} value={type}>{type}</option>)}
                </select>

                {foodForm.name && (
                  <div className="rounded-3xl bg-[hsl(160_50%_45%)]/10 p-3 text-sm text-zinc-700 dark:text-zinc-200">
                    <p className="font-bold text-[hsl(160_50%_45%)]">AI Estimate Food: {foodForm.name}</p>
                    <p>Calories: {foodForm.calories}</p>
                    <p>Protein: {foodForm.protein_g}g</p>
                    <p>Sugar: {foodForm.sugar_g}g</p>
                  </div>
                )}

                <input className="field" placeholder="Cost" type="number" value={foodForm.cost} onChange={(e) => setFoodForm({ ...foodForm, cost: e.target.value })} />

                <div className="rounded-3xl bg-zinc-100 p-4 dark:bg-zinc-800">
                  <p className="mb-2 text-sm font-bold text-zinc-500">Rate this meal</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => setFoodForm({ ...foodForm, rating })}
                        className={classNames(
                          "rounded-2xl p-2 transition",
                          rating <= Number(foodForm.rating || 0) ? "text-[hsl(24_80%_58%)]" : "text-zinc-300"
                        )}
                        aria-label={`${rating} stars`}
                      >
                        <Star className="h-7 w-7" fill={rating <= Number(foodForm.rating || 0) ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                </div>

                <textarea className="min-h-20 w-full rounded-2xl bg-zinc-100 px-4 py-3 outline-none dark:bg-zinc-800" placeholder="Notes" value={foodForm.notes} onChange={(e) => setFoodForm({ ...foodForm, notes: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={estimateFoodFromPhoto} className="rounded-2xl py-3">Estimate calories</Button>
                  <Button onClick={saveFoodMeal} className="rounded-2xl bg-[hsl(24_80%_58%)] py-3 text-white">Save meal</Button>
                </div>
              </div>
            )}

            {captureMode === "spending" && (
              <div className="space-y-2">
                <input className="field" placeholder="Item / what I bought" value={spendingForm.item_name} onChange={(e) => setSpendingForm({ ...spendingForm, item_name: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="field" placeholder="Amount spent" type="number" value={spendingForm.amount} onChange={(e) => setSpendingForm({ ...spendingForm, amount: e.target.value })} />
                  <select className="field" value={spendingForm.category} onChange={(e) => setSpendingForm({ ...spendingForm, category: e.target.value })}>
                    {["Food", "Groceries", "Transport", "Shopping", "Health", "Fun"].map((category) => <option key={category}>{category}</option>)}
                  </select>
                </div>
                <input className="field" placeholder="Merchant" value={spendingForm.merchant} onChange={(e) => setSpendingForm({ ...spendingForm, merchant: e.target.value })} />
                <textarea className="min-h-20 w-full rounded-2xl bg-zinc-100 px-4 py-3 outline-none dark:bg-zinc-800" placeholder="Notes" value={spendingForm.notes} onChange={(e) => setSpendingForm({ ...spendingForm, notes: e.target.value })} />
                <Button onClick={saveSpending} className="w-full rounded-2xl bg-purple-500 py-3 text-white">Save spending</Button>
                {spendingSavedMessage && <p className="rounded-2xl bg-purple-50 p-3 text-sm font-semibold text-purple-700 dark:bg-purple-950/30 dark:text-purple-200">{spendingSavedMessage}</p>}
                <p className="rounded-2xl bg-zinc-100 p-3 text-sm font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  Today's spending total: ${todaySpendingTotal.toFixed(2)}
                </p>
              </div>
            )}

            <button onClick={clearCapture} className="w-full rounded-3xl bg-zinc-100 px-5 py-3 text-sm font-bold text-zinc-500 dark:bg-zinc-800">
              Retake
            </button>
          </div>
        ) : (
          <div className="relative flex items-center justify-center pb-2">
            <label className="absolute left-2 flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl bg-white/10 backdrop-blur-xl transition hover:bg-white/20">
              <ImagePlus className="h-6 w-6" />
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>

            <button
              onClick={captureSnap}
              className="h-20 w-20 rounded-full border-4 border-white bg-white shadow-[0_0_0_8px_rgba(255,255,255,0.16)] transition active:scale-95"
              aria-label="Capture snap"
            />

            <button
              onClick={() => setCameraFacing(cameraFacing === "rear" ? "front" : "rear")}
              className="absolute right-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-xs font-bold backdrop-blur-xl transition hover:bg-white/20"
            >
              Flip
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

const phaseStyles = {
  period: "bg-rose-500 text-white",
  follicular: "bg-[hsl(160_50%_45%)] text-white",
  ovulation: "bg-[hsl(24_80%_58%)] text-white",
  luteal: "bg-amber-300 text-zinc-900",
};

const phaseDotStyles = {
  period: "bg-rose-500",
  follicular: "bg-[hsl(160_50%_45%)]",
  ovulation: "bg-[hsl(24_80%_58%)]",
  luteal: "bg-amber-300",
};

const phaseSoftStyles = {
  period: "bg-rose-50 dark:bg-rose-950/30",
  follicular: "bg-emerald-50 dark:bg-emerald-950/30",
  ovulation: "bg-orange-50 dark:bg-orange-950/30",
  luteal: "bg-amber-50 dark:bg-amber-950/30",
};

const symptomOptions = ["cramps", "bloating", "headache", "back pain", "acne", "fatigue", "cravings"];
const factorOptions = ["travel", "stress", "illness", "sleep change", "medication", "exercise"];
const intimacyButtonLabels = [
  "Special Time Together 💕",
  "Late Night Cardio 😏",
  "Love Meter Activated ❤️",
  "Couple Time ✨",
  "Bedroom Olympics 🏅",
  "Cuddles Escalated 🔥",
  "Romance Logged 💋",
  "Private Event Recorded 🤭",
];

function blankCycleLog() {
  return {
    flow: "none",
    moods: [],
    symptoms: [],
    spotting: false,
    factors: [],
    notes: "",
  };
}

function toLocalDate(iso) {
  return new Date(`${iso}T00:00:00`);
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(startISO, endISO) {
  return Math.floor((toLocalDate(endISO) - toLocalDate(startISO)) / 86400000);
}

function getCyclePhase(cycleStart, dateISO) {
  if (!cycleStart) return { phase: "follicular", day: 1 };
  const cycleDay = (((daysBetween(cycleStart, dateISO) % 28) + 28) % 28) + 1;
  if (cycleDay <= 5) return { phase: "period", day: cycleDay };
  if (cycleDay <= 12) return { phase: "follicular", day: cycleDay };
  if (cycleDay <= 15) return { phase: "ovulation", day: cycleDay };
  return { phase: "luteal", day: cycleDay };
}

function toggleListValue(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function formatCycleDateTitle(dateISO) {
  const date = toLocalDate(dateISO);
  const formatted = date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return dateISO === todayISO ? `Today, ${formatted}` : formatted;
}

function buildMockPeriodLogs() {
  const cycleStart = toLocalDate(todayISO);
  const moods = ["happy", "neutral", "tired", "stressed", "amazing"];
  const symptoms = ["cramps", "bloating", "headache", "fatigue", "cravings"];

  return Array.from({ length: 48 }, (_, index) => {
    const date = new Date(cycleStart);
    date.setDate(cycleStart.getDate() - index * 4);
    const dateISO = toISODate(date);
    const { phase } = getCyclePhase(toISODate(new Date(cycleStart.getFullYear(), cycleStart.getMonth() - 5, 1)), dateISO);

    return {
      date: dateISO,
      phase,
      flow: phase === "period" ? ["light", "medium", "heavy"][index % 3] : "none",
      moods: [moods[index % moods.length]],
      symptoms: [symptoms[index % symptoms.length], symptoms[(index + 2) % symptoms.length]].slice(0, phase === "ovulation" ? 1 : 2),
      notes: "",
    };
  });
}

function Health({ log }) {
  const [activeTab, setActiveTab] = useState("cycle");

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="grid grid-cols-2 rounded-3xl bg-white p-1 shadow-sm dark:bg-zinc-900">
        {[
          { id: "cycle", label: "Cycle" },
          { id: "wellness", label: "Wellness" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={classNames(
              "rounded-3xl py-3 text-sm font-bold transition",
              activeTab === tab.id
                ? "bg-[hsl(24_80%_58%)] text-white"
                : "text-zinc-500"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "cycle" ? <CycleTracker /> : <WellnessInsights log={log} />}
    </motion.div>
  );
}

function CycleTracker() {
  const [cycleStart, setCycleStart] = useState(() => localStorage.getItem("dayflow_cycle_start") || todayISO);
  const [periodLogs, setPeriodLogs] = useState(() => JSON.parse(localStorage.getItem("dayflow_period_logs") || "{}"));
  const [intimacyLogs, setIntimacyLogs] = useState(() => JSON.parse(localStorage.getItem("dayflow_intimacy_logs") || "[]"));
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = toLocalDate(todayISO);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [dailyLog, setDailyLog] = useState(() => ({ ...blankCycleLog(), ...(periodLogs[todayISO] || {}) }));
  const [expandedRows, setExpandedRows] = useState({});
  const [savedMessage, setSavedMessage] = useState("");

  const selectedPhase = useMemo(() => {
    const calculated = getCyclePhase(cycleStart, selectedDate);
    const savedPhase = periodLogs[selectedDate]?.phase || dailyLog.phase;
    return savedPhase ? { phase: savedPhase, day: periodLogs[selectedDate]?.cycleDay || calculated.day } : calculated;
  }, [cycleStart, dailyLog.phase, periodLogs, selectedDate]);
  const selectedDateTitle = formatCycleDateTitle(selectedDate);
  const isMarkedPeriod = dailyLog.flow !== "none" && dailyLog.phase === "period";
  const isIntimacyLogged = intimacyLogs.some((log) => log.date === selectedDate);

  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: firstDay }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => toISODate(new Date(year, month, index + 1))),
    ];
  }, [visibleMonth]);

  function selectDate(dateISO) {
    setSelectedDate(dateISO);
    setDailyLog({ ...blankCycleLog(), ...(periodLogs[dateISO] || {}) });
    setSavedMessage("");
  }

  function saveLog() {
    const phaseData = getCyclePhase(cycleStart, selectedDate);
    const phase = dailyLog.phase || phaseData.phase;
    const nextLogs = {
      ...periodLogs,
      [selectedDate]: {
        ...dailyLog,
        date: selectedDate,
        phase,
        flow: dailyLog.flow,
        moods: dailyLog.moods,
        symptoms: dailyLog.symptoms,
        spotting: dailyLog.spotting,
        factors: dailyLog.factors,
        notes: dailyLog.notes,
        cycle_start: cycleStart,
        cycleDay: phaseData.day,
      },
    };

    localStorage.setItem("dayflow_cycle_start", cycleStart);
    localStorage.setItem("dayflow_period_logs", JSON.stringify(nextLogs));
    setPeriodLogs(nextLogs);
    setSavedMessage(`Saved ${selectedDate}`);
  }

  function savePeriodLog(nextLog) {
    const phaseData = getCyclePhase(cycleStart, selectedDate);
    const logForDate = {
      ...blankCycleLog(),
      ...nextLog,
      date: selectedDate,
      phase: "period",
      flow: "medium",
      cycle_start: cycleStart,
      cycleDay: phaseData.day,
    };
    const nextLogs = {
      ...periodLogs,
      [selectedDate]: logForDate,
    };

    localStorage.setItem("dayflow_cycle_start", cycleStart);
    localStorage.setItem("dayflow_period_logs", JSON.stringify(nextLogs));
    setDailyLog(logForDate);
    setPeriodLogs(nextLogs);
    setSavedMessage(`Marked ${selectedDate} as a period day`);
  }

  function markAsPeriod() {
    savePeriodLog({ ...dailyLog, flow: "medium", phase: "period" });
  }

  function toggleIntimacyLog() {
    const nextLogs = isIntimacyLogged
      ? intimacyLogs.filter((log) => log.date !== selectedDate)
      : [
          ...intimacyLogs,
          {
            id: crypto.randomUUID(),
            date: selectedDate,
            loggedAt: new Date().toISOString(),
            type: "intimacy",
          },
        ];

    localStorage.setItem("dayflow_intimacy_logs", JSON.stringify(nextLogs));
    setIntimacyLogs(nextLogs);
  }

  function toggleExpandedRow(row) {
    setExpandedRows({ ...expandedRows, [row]: !expandedRows[row] });
  }

  function moveMonth(direction) {
    setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + direction, 1));
  }

  return (
    <div className="space-y-4">
      <SoftCard>
        <div className="mb-5">
          <p className="text-3xl font-black tracking-tight">{selectedDateTitle}</p>
          <p className="mt-1 text-sm font-semibold capitalize text-zinc-500">
            Cycle Day {selectedPhase.day} · {selectedPhase.phase}
          </p>
        </div>

        <button
          onClick={markAsPeriod}
          className={classNames(
            "mb-3 w-full rounded-full px-5 py-4 text-base font-bold shadow-sm transition",
            isMarkedPeriod
              ? "bg-[hsl(24_80%_58%)] text-white"
              : "bg-[hsl(24_80%_58%)]/10 text-[hsl(24_80%_58%)]"
          )}
        >
          {isMarkedPeriod ? "Marked as Period ✓" : "Mark as Period"}
        </button>

        <button
          onClick={toggleIntimacyLog}
          className={classNames(
            "mb-4 w-full rounded-full px-5 py-4 text-base font-bold shadow-sm transition",
            isIntimacyLogged
              ? "bg-gradient-to-r from-fuchsia-500 to-rose-400 text-white"
              : "bg-gradient-to-r from-fuchsia-100 to-rose-100 text-fuchsia-700 dark:from-fuchsia-950/50 dark:to-rose-950/50 dark:text-fuchsia-200"
          )}
        >
          {isIntimacyLogged ? "Special Time Logged ✓" : intimacyButtonLabels[0]}
        </button>
        {isIntimacyLogged && (
          <p className="-mt-2 mb-4 text-center text-xs font-semibold text-fuchsia-500">
            A memorable moment together ✨
          </p>
        )}

        <div className="divide-y divide-zinc-100 overflow-hidden rounded-3xl border border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
          <CycleLogRow
            label="Symptoms"
            value={dailyLog.symptoms.length ? dailyLog.symptoms.join(", ") : "None added"}
            accent="text-purple-500"
            onAdd={() => toggleExpandedRow("symptoms")}
          />
          {expandedRows.symptoms && (
            <div className="flex flex-wrap gap-2 bg-zinc-50 p-3 dark:bg-zinc-800/60">
              {symptomOptions.map((symptom) => (
                <button
                  key={symptom}
                  onClick={() => setDailyLog({ ...dailyLog, symptoms: toggleListValue(dailyLog.symptoms, symptom) })}
                  className={classNames(
                    "rounded-full px-3 py-2 text-sm font-semibold capitalize",
                    dailyLog.symptoms.includes(symptom)
                      ? "bg-purple-500 text-white"
                      : "bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                  )}
                >
                  {symptom}
                </button>
              ))}
            </div>
          )}

          <CycleLogRow
            label="Spotting"
            value={dailyLog.spotting ? "Spotting logged" : "No data"}
            accent="text-purple-500"
            onAdd={() => setDailyLog({ ...dailyLog, spotting: !dailyLog.spotting })}
            marked={dailyLog.spotting}
          />

          <CycleLogRow
            label="Factors"
            value={dailyLog.factors.length ? dailyLog.factors.join(", ") : "None added"}
            accent="text-purple-500"
            onAdd={() => toggleExpandedRow("factors")}
          />
          {expandedRows.factors && (
            <div className="flex flex-wrap gap-2 bg-zinc-50 p-3 dark:bg-zinc-800/60">
              {factorOptions.map((factor) => (
                <button
                  key={factor}
                  onClick={() => setDailyLog({ ...dailyLog, factors: toggleListValue(dailyLog.factors, factor) })}
                  className={classNames(
                    "rounded-full px-3 py-2 text-sm font-semibold capitalize",
                    dailyLog.factors.includes(factor)
                      ? "bg-purple-500 text-white"
                      : "bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                  )}
                >
                  {factor}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button onClick={saveLog} className="mt-4 w-full rounded-full bg-purple-500 py-3 text-white">
          Save details
        </Button>
        {savedMessage && <p className="mt-3 rounded-2xl bg-[hsl(160_50%_45%)]/10 p-3 text-sm text-zinc-600">{savedMessage}</p>}
      </SoftCard>

      <SoftCard>
        <SectionTitle icon={CalendarDays} title="Cycle calendar" />
        <p className="mb-4 text-sm font-semibold text-zinc-500">
          Forgot to log a previous day? Select a date below.
        </p>

        <div className="mb-4">
          <label className="text-sm font-semibold">
            <span className="mb-1 block text-zinc-500">Cycle start</span>
            <input
              type="date"
              value={cycleStart}
              onChange={(e) => setCycleStart(e.target.value)}
              className="w-full rounded-2xl bg-zinc-100 px-3 py-3 outline-none dark:bg-zinc-800"
            />
          </label>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => moveMonth(-1)} className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm font-bold dark:bg-zinc-800">‹</button>
          <p className="font-bold">
            {visibleMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
          <button onClick={() => moveMonth(1)} className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm font-bold dark:bg-zinc-800">›</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-zinc-400">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {calendarDays.map((dateISO, index) => {
            if (!dateISO) return <div key={`empty-${index}`} />;
            const { phase: calculatedPhase } = getCyclePhase(cycleStart, dateISO);
            const phase = periodLogs[dateISO]?.phase || calculatedPhase;
            const isSelected = selectedDate === dateISO;
            const isToday = todayISO === dateISO;
            const hasLog = Boolean(periodLogs[dateISO]);

            return (
              <button
                key={dateISO}
                onClick={() => selectDate(dateISO)}
                className={classNames(
                  "relative aspect-square rounded-2xl bg-zinc-50 text-xs font-bold transition dark:bg-zinc-800",
                  isSelected ? "bg-[hsl(24_80%_58%)] text-white shadow-sm" : `${phaseSoftStyles[phase]} text-zinc-700 dark:text-zinc-200`,
                  !isSelected && isToday ? "ring-2 ring-[hsl(24_80%_58%)]/30" : "",
                  !isSelected && hasLog ? "border border-[hsl(160_50%_45%)]/40" : ""
                )}
              >
                {toLocalDate(dateISO).getDate()}
                <span
                  className={classNames(
                    "absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full",
                    isSelected ? "bg-white" : phaseDotStyles[phase]
                  )}
                />
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {Object.keys(phaseDotStyles).map((phase) => (
            <div key={phase} className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-2 text-xs font-semibold capitalize text-zinc-500 dark:bg-zinc-800">
              <span className={classNames("h-2 w-2 rounded-full", phaseDotStyles[phase])} />
              {phase}
            </div>
          ))}
        </div>
      </SoftCard>
    </div>
  );
}

function CycleLogRow({ label, value, accent, onAdd, marked = false }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-white p-4 dark:bg-zinc-900">
      <div>
        <p className="font-semibold">{label}</p>
        <p className="mt-1 text-sm capitalize text-zinc-500">{value}</p>
      </div>
      <button
        onClick={onAdd}
        className={classNames(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 transition dark:bg-zinc-800",
          marked ? "bg-purple-500 text-white" : accent
        )}
      >
        {marked ? "✓" : <Plus className="h-5 w-5" />}
      </button>
    </div>
  );
}

function WellnessInsights({ log }) {
  const insights = useMemo(() => {
    const savedLogs = Object.values(JSON.parse(localStorage.getItem("dayflow_period_logs") || "{}"));
    const mockLogs = buildMockPeriodLogs();
    const currentMood = moodOptions.find((mood) => mood.id === log.mood) || moodOptions[2];
    const currentPhase = getCyclePhase(localStorage.getItem("dayflow_cycle_start") || todayISO, todayISO);
    const dailyLog = {
      date: todayISO,
      phase: currentPhase.phase,
      moods: [currentMood.id],
      symptoms: [],
      notes: log.notes,
    };
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const logs = [...mockLogs, ...savedLogs, dailyLog].filter((item) => toLocalDate(item.date) >= sixMonthsAgo);
    const phases = ["period", "follicular", "ovulation", "luteal"];
    const moodLookup = Object.fromEntries(moodOptions.map((mood) => [mood.id, mood.score]));

    const phaseStats = phases.map((phase) => {
      const phaseLogs = logs.filter((item) => item.phase === phase);
      const moodScores = phaseLogs.flatMap((item) => item.moods || []).map((mood) => moodLookup[mood]).filter(Boolean);
      const symptomCounts = {};
      phaseLogs.flatMap((item) => item.symptoms || []).forEach((symptom) => {
        symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1;
      });

      return {
        phase,
        averageMood: moodScores.length ? moodScores.reduce((sum, score) => sum + score, 0) / moodScores.length : 0,
        count: phaseLogs.length,
        symptomCounts,
      };
    });

    const topSymptoms = {};
    logs.flatMap((item) => item.symptoms || []).forEach((symptom) => {
      topSymptoms[symptom] = (topSymptoms[symptom] || 0) + 1;
    });

    return {
      phaseStats,
      topSymptoms: Object.entries(topSymptoms).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [log]);

  return (
    <div className="space-y-4">
      <SoftCard>
        <SectionTitle icon={Smile} title="Mood by phase" />
        <div className="space-y-3">
          {insights.phaseStats.map((stat) => (
            <div key={stat.phase}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-semibold capitalize">{stat.phase}</span>
                <span className="text-zinc-500">{stat.averageMood.toFixed(1)} / 5</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className="h-full bg-[hsl(160_50%_45%)]" style={{ width: `${(stat.averageMood / 5) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </SoftCard>

      <div className="grid grid-cols-2 gap-3">
        {insights.phaseStats.map((stat) => (
          <div key={stat.phase} className="rounded-3xl bg-white p-4 shadow-sm dark:bg-zinc-900">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">{stat.phase}</p>
            <p className="mt-2 text-2xl font-bold">{stat.averageMood.toFixed(1)}</p>
            <p className="text-xs text-zinc-500">avg mood from {stat.count} logs</p>
          </div>
        ))}
      </div>

      <SoftCard>
        <SectionTitle icon={HeartPulse} title="Symptom distribution" />
        <div className="grid grid-cols-2 gap-3">
          {insights.phaseStats.map((stat) => {
            const total = Object.values(stat.symptomCounts).reduce((sum, count) => sum + count, 0);
            return (
              <div key={stat.phase} className="rounded-3xl bg-zinc-100 p-4 dark:bg-zinc-800">
                <div className={classNames("mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full", phaseStyles[stat.phase])}>
                  <span className="text-xl font-bold">{total}</span>
                </div>
                <p className="text-center text-sm font-bold capitalize">{stat.phase}</p>
              </div>
            );
          })}
        </div>
      </SoftCard>

      <SoftCard>
        <SectionTitle icon={Star} title="Top symptoms" />
        <div className="space-y-2">
          {insights.topSymptoms.map(([symptom, count]) => (
            <div key={symptom} className="flex items-center justify-between rounded-2xl bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
              <span className="font-semibold capitalize">{symptom}</span>
              <span className="rounded-2xl bg-[hsl(24_80%_58%)]/10 px-3 py-1 font-bold text-[hsl(24_80%_58%)]">{count}</span>
            </div>
          ))}
        </div>
      </SoftCard>
    </div>
  );
}

const planInspirationIdeas = [
  {
    title: "Movie + dessert night",
    category: "Movies",
    idea: "Watch a trending romantic movie, then try a new dessert cafe.",
    reason: "Based on your interest in cozy plans and entertainment.",
  },
  {
    title: "Live music dinner walk",
    category: "Music",
    idea: "Pick a casual dinner spot, then find a small live set nearby.",
    reason: "Music plans work well when you want something low-pressure but memorable.",
  },
  {
    title: "Series premiere snack date",
    category: "Shows",
    idea: "Start a buzzed-about show and build a snack board around it.",
    reason: "A good pick for staying in while still making the night feel planned.",
  },
  {
    title: "Celebrity restaurant crawl",
    category: "Celebrity",
    idea: "Try a spot inspired by a celebrity food trend, then vote on dessert.",
    reason: "Turns pop-culture curiosity into an easy shared adventure.",
  },
  {
    title: "Slow morning date",
    category: "Date ideas",
    idea: "Brunch, a short walk, and one choose-your-own stop afterward.",
    reason: "Flexible enough for both of you to shape the day together.",
  },
];

function createBlankChoiceBlock(question = "") {
  return {
    id: crypto.randomUUID(),
    question,
    choices: ["", "", ""],
    partnerChoice: null,
  };
}

function normalizePlan(plan) {
  const now = new Date().toISOString();
  const choiceBlocks = (plan.choiceBlocks || []).map((block) => ({
    id: block.id || crypto.randomUUID(),
    question: block.question || "",
    choices: block.choices || (block.options || []).map((option) => option.text || "").concat(["", "", ""]).slice(0, 3),
    partnerChoice: block.partnerChoice ?? null,
  }));

  return {
    id: plan.id || crypto.randomUUID(),
    title: plan.title || "Untitled plan",
    content: plan.content || "",
    date: plan.date || todayISO,
    status: plan.status || "draft",
    inspiration: plan.inspiration || null,
    choiceBlocks,
    finalPlan: plan.finalPlan || plan.finalizedItinerary?.map((item) => ({ question: item.section, selectedChoice: item.text })) || [],
    createdAt: plan.createdAt || now,
    updatedAt: plan.updatedAt || now,
  };
}

function Entertainment({ log, setLog }) {
  const [plans, setPlans] = useState(() => {
    const savedPlans = localStorage.getItem("dayflow_fun_plans");
    const parsedPlans = savedPlans ? JSON.parse(savedPlans) : [];
    return parsedPlans.map(normalizePlan).filter((plan) => plan.status !== "draft");
  });

  const [entertainmentCategory, setEntertainmentCategory] = useState("Movies");
  const [usTab, setUsTab] = useState("updates");
  const [connectedPartner, setConnectedPartner] = useState(null);
  const [planForm, setPlanForm] = useState({
    title: "",
    content: "",
    date: todayISO,
    inspiration: null,
    choiceBlocks: [createBlankChoiceBlock("What should we do first?")],
  });
  const [planError, setPlanError] = useState("");
  const [aiPlanIdeas, setAiPlanIdeas] = useState([]);
  const entertainmentCategories = [
    { label: "Movies", icon: "🎬" },
    { label: "Shows", icon: "📺" },
    { label: "Music", icon: "🎵" },
  ];
  const memorySnaps = log.snaps.filter((snap) => !snap.type || snap.type === "memory");
  const partnerUpdates = [
    { type: "wake", text: `Wake-up time logged at ${log.wake_up_time || "7:30"} ☀️` },
    { type: "meal", text: log.meals[0]?.name ? `Logged ${log.meals[0].name} for ${log.meals[0].type || "a meal"} 🍜` : "Logged ramen for lunch 🍜" },
    { type: "mood", text: `${connectedPartner?.name || "Emily"} felt ${moodOptions.find((mood) => mood.id === log.mood)?.label.toLowerCase() || "happy"} today ${moodOptions.find((mood) => mood.id === log.mood)?.emoji || "😊"}` },
    { type: "workout", text: "Finished Shoulder/Arm workout 💪" },
    { type: "snap", text: memorySnaps[0]?.caption ? `Shared a memory: ${memorySnaps[0].caption}` : "Shared a snap from today 📸" },
    { type: "notes", text: log.notes ? `Left a note: ${log.notes}` : "Left a small daily note 📝" },
  ];
  const waitingPlans = plans.filter((plan) => plan.status === "sent_to_partner");
  const finalizedPlans = plans.filter((plan) => plan.status === "finalized");

  useEffect(() => {
    localStorage.setItem("dayflow_fun_plans", JSON.stringify(plans));
  }, [plans]);

  function resetPlanForm() {
    setPlanForm({
      title: "",
      content: "",
      date: todayISO,
      inspiration: null,
      choiceBlocks: [createBlankChoiceBlock("What should we do first?")],
    });
    setAiPlanIdeas([]);
    setPlanError("");
  }

  function suggestPlanIdeas() {
    const categoryIdeas = planInspirationIdeas.filter((idea) => idea.category === entertainmentCategory);
    const fallbackIdeas = planInspirationIdeas.filter((idea) => idea.category !== entertainmentCategory);
    setAiPlanIdeas([...categoryIdeas, ...fallbackIdeas].slice(0, 3));
  }

  function applyPlanIdea(idea) {
    setPlanForm({
      ...planForm,
      title: idea.title,
      content: idea.idea,
      inspiration: idea,
    });
  }

  function updateChoiceBlock(blockId, updates) {
    setPlanForm({
      ...planForm,
      choiceBlocks: planForm.choiceBlocks.map((block) => block.id === blockId ? { ...block, ...updates } : block),
    });
  }

  function addChoiceBlock() {
    setPlanForm({
      ...planForm,
      choiceBlocks: [...planForm.choiceBlocks, createBlankChoiceBlock()],
    });
  }

  function removeChoiceBlock(blockId) {
    setPlanForm({
      ...planForm,
      choiceBlocks: planForm.choiceBlocks.filter((block) => block.id !== blockId),
    });
  }

  function updateChoice(blockId, choiceIndex, value) {
    setPlanForm({
      ...planForm,
      choiceBlocks: planForm.choiceBlocks.map((block) => block.id === blockId
        ? {
            ...block,
            choices: block.choices.map((choice, index) => index === choiceIndex ? value : choice),
          }
        : block),
    });
  }

  function validatePlanForm() {
    if (!planForm.title.trim()) return "Add a plan title first.";
    const invalidBlock = planForm.choiceBlocks.find((block) => {
      const choices = block.choices.map((choice) => choice.trim()).filter(Boolean);
      return !block.question.trim() || choices.length < 2;
    });
    return invalidBlock ? "Each choice block needs a question and at least 2 choices." : "";
  }

  function sendPlanToPartner() {
    const error = validatePlanForm();
    if (error) {
      setPlanError(error);
      return;
    }
    const now = new Date().toISOString();
    const choiceBlocks = planForm.choiceBlocks.map((block) => ({
      id: block.id,
      question: block.question.trim(),
      choices: block.choices.map((choice) => choice.trim()),
      partnerChoice: null,
    })).filter((block) => block.question && block.choices.filter(Boolean).length >= 2);

    setPlans([
      ...plans,
      {
        id: crypto.randomUUID(),
        title: planForm.title.trim(),
        content: planForm.content,
        date: planForm.date,
        status: "sent_to_partner",
        inspiration: planForm.inspiration,
        choiceBlocks,
        finalPlan: [],
        createdAt: now,
        updatedAt: now,
      },
    ]);

    resetPlanForm();
    setUsTab("plans");
  }

  function choosePartnerOption(planId, blockId, choiceIndex) {
    const now = new Date().toISOString();
    setPlans(plans.map((plan) => plan.id === planId
      ? {
          ...plan,
          choiceBlocks: plan.choiceBlocks.map((block) => block.id === blockId ? { ...block, partnerChoice: choiceIndex } : block),
          updatedAt: now,
        }
      : plan));
  }

  function confirmPartnerChoices(planId) {
    const now = new Date().toISOString();
    setPlans(plans.map((plan) => {
      if (plan.id !== planId) return plan;
      const finalPlan = plan.choiceBlocks
        .filter((block) => block.partnerChoice !== null && block.choices[block.partnerChoice])
        .map((block) => ({
          question: block.question,
          selectedChoice: block.choices[block.partnerChoice],
        }));

      return {
        ...plan,
        status: "finalized",
        finalPlan,
        updatedAt: now,
      };
    }));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <SoftCard>
        <div className="mb-4">
          <p id="py5l1x" className="text-2xl font-bold">💕 Us</p>
          <p id="g9lh0k" className="mt-1 text-sm text-zinc-500">Stay connected through daily moments.</p>
        </div>

        {!connectedPartner && (
          <div className="mb-4 rounded-3xl bg-gradient-to-br from-orange-50 to-rose-50 p-4 shadow-sm dark:from-zinc-800 dark:to-zinc-900">
            <p id="tbmjlwm" className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
              Connect with your partner to share updates, plans, and memories.
            </p>
            <Button
              id="0frvww"
              onClick={() => setConnectedPartner({ id: "mock-partner", name: "Emily" })}
              className="mt-3 rounded-2xl bg-[hsl(24_80%_58%)] text-white"
            >
              Invite Partner
            </Button>
          </div>
        )}

        <div className="mb-4 grid grid-cols-3 rounded-3xl bg-zinc-100 p-1 dark:bg-zinc-800">
          {[
            { id: "updates", label: "Updates" },
            { id: "plans", label: "Plans" },
            { id: "memories", label: "Memories" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setUsTab(tab.id)}
              className={classNames(
                "rounded-3xl py-3 text-sm font-bold transition",
                usTab === tab.id
                  ? "bg-[hsl(24_80%_58%)] text-white shadow-sm"
                  : "text-zinc-500"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {usTab === "updates" && (
          <div className="space-y-3">
            <div className="rounded-3xl bg-[hsl(30_30%_98%)] p-4 dark:bg-zinc-800">
              <p className="font-bold">Shared daily feed</p>
              <p className="mt-1 text-sm text-zinc-500">
                Future shared data will include moods, meals, workouts, snaps, notes, wake-up times, plans, and memories.
              </p>
            </div>
            {partnerUpdates.map((update) => (
              <div key={`${update.type}-${update.text}`} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100 dark:bg-zinc-900 dark:ring-zinc-800">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[hsl(160_50%_45%)]">{update.type}</p>
                <p className="mt-1 font-semibold text-zinc-700 dark:text-zinc-200">{update.text}</p>
              </div>
            ))}
          </div>
        )}

        {usTab === "plans" && (
          <div className="space-y-4">
            <div className="rounded-3xl bg-[hsl(30_30%_98%)] p-4 dark:bg-zinc-800">
              <div className="mb-3">
                <p className="font-bold">AI date inspiration</p>
                <p className="text-sm text-zinc-500">Start from trend-aware date ideas, then make it yours.</p>
              </div>
              <Button onClick={suggestPlanIdeas} className="w-full rounded-2xl bg-[hsl(24_80%_58%)] py-3 text-white">
                Suggest from latest trends
              </Button>
              {aiPlanIdeas.length > 0 && (
                <div className="mt-3 grid gap-2">
                  {aiPlanIdeas.map((idea) => (
                    <div key={idea.title} className="rounded-3xl bg-white p-3 shadow-sm dark:bg-zinc-900">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">{idea.title}</p>
                          <p className="text-xs font-bold text-[hsl(160_50%_45%)]">{idea.category}</p>
                        </div>
                        <Button variant="secondary" onClick={() => applyPlanIdea(idea)} className="rounded-2xl text-xs">
                          Use this idea
                        </Button>
                      </div>
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{idea.idea}</p>
                      <p className="mt-1 text-xs text-zinc-500">{idea.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100 dark:bg-zinc-900 dark:ring-zinc-800">
              <p className="mb-3 font-bold">Make Plan</p>
              <div className="space-y-3">
                <input
                  className="field"
                  placeholder="Plan title"
                  value={planForm.title}
                  onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
                />
                <textarea
                  className="min-h-24 w-full rounded-2xl bg-zinc-100 px-4 py-3 outline-none dark:bg-zinc-800"
                  placeholder="Plan details"
                  value={planForm.content}
                  onChange={(e) => setPlanForm({ ...planForm, content: e.target.value })}
                />
                <input
                  type="date"
                  className="field"
                  value={planForm.date}
                  onChange={(e) => setPlanForm({ ...planForm, date: e.target.value })}
                />
              </div>
            </div>

            <div className="rounded-3xl bg-[hsl(30_30%_98%)] p-4 dark:bg-zinc-800">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold">Build choices for the plan</p>
                  <p className="text-sm text-zinc-500">Keep each question simple with two required choices and one optional backup.</p>
                </div>
                <Button variant="secondary" onClick={addChoiceBlock} className="rounded-2xl text-xs">
                  Add block
                </Button>
              </div>

              <div className="space-y-3">
                {planForm.choiceBlocks.map((block) => (
                  <div key={block.id} className="rounded-3xl bg-white p-3 dark:bg-zinc-900">
                    <div className="mb-3 flex gap-2">
                      <input
                        className="field"
                        placeholder="Question"
                        value={block.question}
                        onChange={(e) => updateChoiceBlock(block.id, { question: e.target.value })}
                      />
                      <Button variant="secondary" size="icon" onClick={() => removeChoiceBlock(block.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <input className="field" placeholder="Choice A" value={block.choices[0] || ""} onChange={(e) => updateChoice(block.id, 0, e.target.value)} />
                      <input className="field" placeholder="Choice B" value={block.choices[1] || ""} onChange={(e) => updateChoice(block.id, 1, e.target.value)} />
                      <input className="field" placeholder="Add another option (optional)" value={block.choices[2] || ""} onChange={(e) => updateChoice(block.id, 2, e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {planError && <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-600 dark:bg-rose-950/30 dark:text-rose-200">{planError}</p>}
            <Button onClick={sendPlanToPartner} className="w-full rounded-2xl bg-[hsl(24_80%_58%)] py-4 text-white">
              Send to Partner
            </Button>

            {waitingPlans.length === 0 && finalizedPlans.length === 0 && (
              <div className="rounded-3xl bg-[hsl(160_50%_45%)]/10 p-5 text-center">
                <p className="font-bold">No plans yet</p>
                <p className="mt-1 text-sm text-zinc-500">Send a plan and it will show up here.</p>
              </div>
            )}
            {[
              { title: "Waiting for partner", items: waitingPlans },
              { title: "Final Plan", items: finalizedPlans },
            ].map(({ title, items }) => {
              if (!items.length) return null;

              return (
                <div key={title} className="space-y-2">
                  <p className="text-sm font-black text-zinc-500">{title}</p>
                  {items.map((plan) => (
                    <div key={plan.id} className="rounded-3xl bg-[hsl(30_30%_98%)] p-4 shadow-sm dark:bg-zinc-800">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">{plan.title}</p>
                          <p className="text-xs text-zinc-500">{plan.date}</p>
                        </div>
                        <span className={classNames(
                          "rounded-full px-3 py-1 text-xs font-bold capitalize",
                          plan.status === "finalized"
                            ? "bg-[hsl(24_80%_58%)]/10 text-[hsl(24_80%_58%)]"
                            : "bg-[hsl(160_50%_45%)]/10 text-[hsl(160_50%_45%)]"
                        )}>
                          {plan.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300">{plan.content}</p>
                      {plan.inspiration && (
                        <p className="mt-2 rounded-2xl bg-white p-3 text-xs text-zinc-500 dark:bg-zinc-900">
                          Inspired by {plan.inspiration.category}: {plan.inspiration.title}
                        </p>
                      )}
                      {plan.choiceBlocks.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {plan.choiceBlocks.map((block) => (
                            <div key={block.id} className="rounded-2xl bg-white p-3 dark:bg-zinc-900">
                              <p className="text-sm font-bold">{block.question || "Choice"}</p>
                              <div className="mt-2 grid gap-2">
                                {block.choices.filter(Boolean).map((choice, index) => (
                                  <button
                                    key={`${choice}-${index}`}
                                    onClick={() => plan.status === "sent_to_partner" ? choosePartnerOption(plan.id, block.id, index) : null}
                                    className={classNames(
                                      "rounded-2xl px-3 py-2 text-left text-xs font-semibold",
                                      block.partnerChoice === index
                                        ? "bg-[hsl(24_80%_58%)] text-white"
                                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                                    )}
                                  >
                                    {["A", "B", "C"][index]}. {choice}
                                    {block.partnerChoice === index && " · Partner selected"}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {plan.status === "sent_to_partner" && (
                        <Button onClick={() => confirmPartnerChoices(plan.id)} className="mt-3 w-full rounded-2xl bg-[hsl(24_80%_58%)] py-3 text-white">
                          Confirm Partner Choices
                        </Button>
                      )}
                      {plan.finalPlan.length > 0 && (
                        <div className="mt-3 rounded-2xl bg-[hsl(24_80%_58%)]/10 p-3">
                          <p className="text-sm font-bold text-[hsl(24_80%_58%)]">Final Plan</p>
                          <div className="mt-2 space-y-1">
                            {plan.finalPlan.map((item, index) => (
                              <p key={`${item.selectedChoice}-${index}`} className="text-xs text-zinc-600 dark:text-zinc-300">
                                {item.question}: {item.selectedChoice}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {usTab === "memories" && (
          <div className="space-y-4">
            {memorySnaps.length === 0 ? (
              <div className="rounded-3xl bg-[hsl(160_50%_45%)]/10 p-5 text-center">
                <p className="font-bold">No shared memories yet</p>
                <p className="mt-1 text-sm text-zinc-500">Save a snap as a memory and it will appear here.</p>
              </div>
            ) : (
              memorySnaps.map((snap, index) => (
                <div key={`${snap.url}-${index}`} className="overflow-hidden rounded-3xl bg-zinc-100 shadow-sm dark:bg-zinc-800">
                  <img src={snap.url} className="h-48 w-full object-cover" alt={snap.caption || "Memory"} />

                  <div className="p-3 text-sm">
                    <p className="font-semibold">{snap.caption || "A Dayflow moment"}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {snap.taken_at ? new Date(snap.taken_at).toLocaleString() : "Saved memory"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </SoftCard>

      <Gym log={log} setLog={setLog} />

      <SoftCard>
        <div className="mb-5">
          <p className="text-3xl font-bold tracking-tight">Entertainment</p>
          <p className="mt-1 text-sm text-zinc-500">Discover what&apos;s trending</p>
        </div>

        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-[hsl(24_80%_58%)] px-6 py-3 text-sm font-bold text-white shadow-sm">
            🎬 What&apos;s On
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {entertainmentCategories.map((category) => {
            const selected = entertainmentCategory === category.label;
            return (
              <button
                key={category.label}
                onClick={() => setEntertainmentCategory(category.label)}
                className={classNames(
                  "rounded-full px-3 py-3 text-sm font-bold shadow-sm transition",
                  selected
                    ? "bg-[hsl(24_80%_58%)] text-white"
                    : "bg-[hsl(30_30%_98%)] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                )}
              >
                {category.icon} {category.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {entertainmentNews[entertainmentCategory].map((news) => (
            <div
              key={news}
              className="rounded-3xl bg-[hsl(30_30%_98%)] p-4 text-sm font-medium text-zinc-700 shadow-sm dark:bg-zinc-800 dark:text-zinc-200"
            >
              {news}
            </div>
          ))}
        </div>
      </SoftCard>
    </motion.div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    const savedUser = JSON.parse(localStorage.getItem("dayflow_user") || "null");
    const activeSession = localStorage.getItem("dayflow_active_session");

    if (savedUser && activeSession !== "false") {
      localStorage.setItem("dayflow_active_session", "true");
      return savedUser;
    }
    return null;
  });

  function handleAuthenticated(nextUser) {
    setUser(nextUser);
  }

  function handleLogout() {
    // Future Supabase Auth: replace this with supabase.auth.signOut().
    localStorage.setItem("dayflow_active_session", "false");
    setUser(null);
  }

  if (!user) {
    return <Onboarding onAuthenticated={handleAuthenticated} />;
  }

  return <AppShell user={user} onLogout={handleLogout} />;
}
