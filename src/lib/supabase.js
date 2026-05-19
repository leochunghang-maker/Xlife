import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

async function cloudUpsert(tableName, row, conflictTarget = "id") {
  if (!supabase) return { data: null, error: null, skipped: true };

  const { data, error } = await supabase
    .from(tableName)
    .upsert(row, { onConflict: conflictTarget })
    .select()
    .single();

  return { data, error, skipped: false };
}

async function cloudSelect(tableName, userId, filters = {}) {
  if (!supabase || !userId) return { data: null, error: null, skipped: true };

  let query = supabase
    .from(tableName)
    .select("*")
    .eq("user_id", userId);

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query = query.eq(key, value);
    }
  });

  const { data, error } = await query;
  return { data, error, skipped: false };
}

export async function saveDailyLogToCloud(userId, dailyLog) {
  // Future table: daily_logs { id, user_id, date, log, created_at, updated_at }
  return cloudUpsert("daily_logs", {
    id: dailyLog.id || `${userId}-${dailyLog.date}`,
    user_id: userId,
    date: dailyLog.date,
    log: dailyLog,
    updated_at: new Date().toISOString(),
  });
}

export async function loadDailyLogFromCloud(userId, date) {
  // Future table: daily_logs, filtered by user_id and date.
  return cloudSelect("daily_logs", userId, { date });
}

export async function saveMealToCloud(userId, meal) {
  // Future table: meals { id, user_id, date, meal_type, name, nutrition, notes }
  return cloudUpsert("meals", {
    id: meal.id || crypto.randomUUID(),
    user_id: userId,
    date: meal.date || new Date().toISOString().slice(0, 10),
    meal_type: meal.meal_type || meal.type,
    name: meal.name,
    meal,
    updated_at: new Date().toISOString(),
  });
}

export async function loadMealsFromCloud(userId, date) {
  // Future table: meals, filtered by user_id and optional date.
  return cloudSelect("meals", userId, { date });
}

export async function savePeriodLogToCloud(userId, periodLog) {
  // Future table: period_logs { id, user_id, date, phase, flow, symptoms, factors }
  return cloudUpsert("period_logs", {
    id: periodLog.id || `${userId}-${periodLog.date}`,
    user_id: userId,
    date: periodLog.date,
    period_log: periodLog,
    updated_at: new Date().toISOString(),
  });
}

export async function saveWorkoutToCloud(userId, workout) {
  // Future table: workouts { id, user_id, date, type, exercises, summary }
  return cloudUpsert("workouts", {
    id: workout.id || crypto.randomUUID(),
    user_id: userId,
    date: workout.date || new Date().toISOString().slice(0, 10),
    workout,
    updated_at: new Date().toISOString(),
  });
}

export async function savePlanToCloud(userId, plan) {
  // Future table: plans { id, user_id, status, title, date, choice_blocks, final_plan }
  return cloudUpsert("plans", {
    id: plan.id || crypto.randomUUID(),
    user_id: userId,
    status: plan.status,
    title: plan.title,
    date: plan.date,
    plan,
    updated_at: new Date().toISOString(),
  });
}

export async function saveRestaurantToCloud(userId, restaurant) {
  // Future table: restaurants { id, user_id, name, cuisine, location, menu_items }
  return cloudUpsert("restaurants", {
    id: restaurant.id || crypto.randomUUID(),
    user_id: userId,
    name: restaurant.name,
    cuisine: restaurant.cuisine,
    restaurant,
    updated_at: new Date().toISOString(),
  });
}
