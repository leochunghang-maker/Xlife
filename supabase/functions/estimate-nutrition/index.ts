// Server-only entrypoint. No service-role or provider key is sent to the client.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createHandler } from "./handler.ts";
const url = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const userClient = (authorization: string, signal: AbortSignal) =>
  createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: authorization },
      fetch: (input, init) => fetch(input, { ...init, signal }),
    },
  });
Deno.serve(createHandler({
  apiKey: Deno.env.get("OPENAI_API_KEY") || "",
  model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
  async authenticate(authorization, signal) {
    const { data, error } = await userClient(authorization, signal).auth
      .getUser();
    if (error) return null;
    return data?.user || null;
  },
  async reserve(authorization, signal) {
    const { data, error } = await userClient(authorization, signal).rpc(
      "reserve_nutrition_quota",
    );
    if (error || typeof data !== "boolean") {
      throw new Error("quota unavailable");
    }
    return data;
  },
}));
