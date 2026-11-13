// Supabase Edge Function: estimate nutrition from a food photo.
//
// The OpenAI key lives ONLY in the function's secrets (OPENAI_API_KEY) and is
// never shipped to the app. Callers must be signed in (JWT verified by
// Supabase); each user gets a small daily quota (AI_DAILY_LIMIT, default 30).
// Results are approximate estimates for the user to review and edit.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_IMAGE_BYTES = 2_000_000;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["is_food", "items", "total", "confidence", "notes"],
  properties: {
    is_food: { type: "boolean" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "portion", "calories", "protein_g", "carbs_g", "fat_g", "sugar_g"],
        properties: {
          name: { type: "string" },
          portion: { type: "string" },
          calories: { type: "number" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" },
          sugar_g: { type: "number" },
        },
      },
    },
    total: {
      type: "object",
      additionalProperties: false,
      required: ["calories", "protein_g", "carbs_g", "fat_g", "sugar_g"],
      properties: {
        calories: { type: "number" },
        protein_g: { type: "number" },
        carbs_g: { type: "number" },
        fat_g: { type: "number" },
        sugar_g: { type: "number" },
      },
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    notes: { type: "string" },
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return json({ error: "AI estimation is not configured on the server." }, 503);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return json({ error: "Sign in to use AI estimates." }, 401);
  const userId = userData.user.id;

  // Per-user daily quota.
  const admin = createClient(supabaseUrl, serviceKey);
  const limit = Number(Deno.env.get("AI_DAILY_LIMIT") ?? "30");
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("ai_requests").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
  if ((count ?? 0) >= limit) return json({ error: "Daily AI estimate limit reached. Try again tomorrow." }, 429);

  let body: { image?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const image = body.image ?? "";
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image)) return json({ error: "Send a JPEG/PNG/WebP data URL." }, 400);
  if (image.length * 0.75 > MAX_IMAGE_BYTES) return json({ error: "Photo is too large." }, 413);
  const note = String(body.note ?? "").slice(0, 300);

  await admin.from("ai_requests").insert({ user_id: userId, kind: "nutrition" });

  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_schema", json_schema: { name: "nutrition_estimate", strict: true, schema } },
      messages: [
        {
          role: "system",
          content:
            "You estimate nutrition from meal photos. Identify each visible food, estimate a realistic portion, and give approximate calories and macros. " +
            "Be honest about uncertainty: hidden oil, sauces and portion size are common error sources, mention them in notes. " +
            "If the image is not food, set is_food=false, items=[], totals 0. Never invent brand names.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: note ? `User note about the meal: ${note}` : "Estimate this meal." },
            { type: "image_url", image_url: { url: image, detail: "low" } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    console.error("openai error", response.status, await response.text());
    return json({ error: "The AI service couldn't analyse that photo." }, 502);
  }
  const completion = await response.json();
  try {
    const estimate = JSON.parse(completion.choices?.[0]?.message?.content ?? "{}");
    return json({ estimate, model, approximate: true });
  } catch {
    return json({ error: "Unexpected AI response." }, 502);
  }
});
