import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

function createLocalUser({ id = crypto.randomUUID(), email, name }) {
  return {
    id,
    name: name || email?.split("@")[0] || "Xlife user",
    email,
    avatar_url: "",
    profile_photo_url: "",
    relationship_mode: "Solo",
    created_at: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

function normalizeProfile(profile, authUser = {}) {
  return {
    id: profile?.id || authUser.id,
    name: profile?.name || authUser.user_metadata?.name || authUser.email?.split("@")[0] || "Xlife user",
    email: profile?.email || authUser.email || "",
    avatar_url: profile?.avatar_url || "",
    profile_photo_url: profile?.avatar_url || "",
    relationship_mode: profile?.relationship_mode || "Solo",
    created_at: profile?.created_at || authUser.created_at || new Date().toISOString(),
    createdAt: profile?.created_at || authUser.created_at || new Date().toISOString(),
  };
}

async function upsertProfile(profile) {
  if (!supabase) return { data: profile, error: null, skipped: true };

  // Supabase table: profiles { id uuid references auth.users(id), name, email, avatar_url, relationship_mode, created_at }
  const { data, error } = await supabase
    .from("profiles")
    .upsert(profile, { onConflict: "id" })
    .select()
    .single();

  return { data, error, skipped: false };
}

async function loadProfile(user) {
  if (!supabase || !user?.id) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function signUp(email, password, name) {
  if (!isSupabaseConfigured || !supabase) {
    const user = createLocalUser({ email, name });
    localStorage.setItem("dayflow_user", JSON.stringify(user));
    localStorage.setItem("dayflow_active_session", "true");
    return { user, error: null, skipped: true };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) return { user: null, error, skipped: false };

  const authUser = data.user;
  const profile = {
    id: authUser.id,
    name,
    email,
    avatar_url: "",
    relationship_mode: "Solo",
    created_at: new Date().toISOString(),
  };
  const { data: savedProfile, error: profileError } = await upsertProfile(profile);

  if (profileError) return { user: normalizeProfile(profile, authUser), error: profileError, skipped: false };
  return { user: normalizeProfile(savedProfile, authUser), error: null, skipped: false };
}

export async function signIn(email, password) {
  if (!isSupabaseConfigured || !supabase) {
    const savedUser = JSON.parse(localStorage.getItem("dayflow_user") || "null");
    if (!savedUser || savedUser.email?.toLowerCase() !== email.toLowerCase()) {
      return { user: null, error: new Error("We could not find that email yet."), skipped: true };
    }
    localStorage.setItem("dayflow_active_session", "true");
    return { user: savedUser, error: null, skipped: true };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { user: null, error, skipped: false };

  const profile = await loadProfile(data.user);
  return { user: normalizeProfile(profile, data.user), error: null, skipped: false };
}

export async function signOut() {
  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut();
  }

  localStorage.setItem("dayflow_active_session", "false");
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured || !supabase) {
    const savedUser = JSON.parse(localStorage.getItem("dayflow_user") || "null");
    const activeSession = localStorage.getItem("dayflow_active_session");
    return savedUser && activeSession !== "false" ? savedUser : null;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const profile = await loadProfile(data.user);
  return normalizeProfile(profile, data.user);
}

export async function saveUserProfile(profile) {
  if (!isSupabaseConfigured || !supabase) {
    const current = JSON.parse(localStorage.getItem("dayflow_user") || "null");
    const nextUser = { ...current, ...profile };
    localStorage.setItem("dayflow_user", JSON.stringify(nextUser));
    return { data: nextUser, error: null, skipped: true };
  }

  return upsertProfile({
    id: profile.id,
    name: profile.name,
    email: profile.email,
    avatar_url: profile.avatar_url || "",
    relationship_mode: profile.relationship_mode || "Solo",
    created_at: profile.created_at || new Date().toISOString(),
  });
}

// Next phase Supabase tables:
// partner_connections, shared_memories, plans, daily_updates.

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
