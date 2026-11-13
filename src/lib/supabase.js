// Supabase client + feature flags. Cloud features stay OFF (pure local mode)
// unless both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set at build
// time and VITE_ENABLE_CLOUD isn't "false".
//
// The anon (publishable) key is designed to be public: every table is
// protected by Row Level Security (supabase/migrations). NEVER put the
// service-role key or the OpenAI key in a VITE_ variable — those live only in
// Supabase Edge Function secrets.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey) && import.meta.env.VITE_ENABLE_CLOUD !== "false";

// AI food-photo estimates also need the edge function deployed with its secret.
export const isAiNutritionEnabled = isSupabaseConfigured && import.meta.env.VITE_ENABLE_AI_NUTRITION === "true";

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;
