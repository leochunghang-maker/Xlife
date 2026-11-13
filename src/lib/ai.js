// Client for the estimate-nutrition edge function. The OpenAI key never
// touches the app; only signed-in Xlife Cloud users can call it.
import { supabase, isAiNutritionEnabled } from "./supabase";
import { readPhotoAsDataUrl } from "./photoStore";
import { compressImage } from "./photos";

export { isAiNutritionEnabled };

export async function estimateNutritionFromPhoto(photoRef, note = "") {
  if (!isAiNutritionEnabled || !supabase) throw new Error("AI estimates aren't configured in this build.");
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error("Sign in to Xlife Cloud (Settings) to use AI estimates.");
  const original = await readPhotoAsDataUrl(photoRef);
  if (!original) throw new Error("Couldn't read that photo.");
  const image = await compressImage(original, { maxDimension: 768, quality: 0.7 }).catch(() => original);
  const { data, error } = await supabase.functions.invoke("estimate-nutrition", { body: { image, note } });
  if (error) {
    let message = error.message;
    try {
      message = (await error.context?.json())?.error || message;
    } catch {
      // keep default message
    }
    throw new Error(message || "AI estimate failed.");
  }
  return data.estimate;
}
