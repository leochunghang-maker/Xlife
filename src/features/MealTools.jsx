import { useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Star, ScanBarcode, Sparkles } from "lucide-react";
import { Button } from "../components/ui.jsx";
import { readMyFoods, saveMyFoods, toMyFood, foodKey, frequentMeals, lookupBarcode, nutritionForGrams, isValidBarcode } from "../lib/foodData";
import { isAiNutritionEnabled, estimateNutritionFromPhoto } from "../lib/ai";

// One-tap re-logging (MyFitnessPal / Lose It style): starred "My foods" plus
// the meals you log most often.
export function QuickAdd({ mealHistory, onLog }) {
  const [myFoods, setMyFoods] = useState(readMyFoods);
  const frequent = useMemo(() => frequentMeals(mealHistory), [mealHistory]);
  const savedKeys = new Set(myFoods.map(foodKey));

  function toggleSaved(meal) {
    const key = foodKey(meal);
    const next = savedKeys.has(key) ? myFoods.filter((food) => foodKey(food) !== key) : [toMyFood(meal), ...myFoods];
    setMyFoods(next);
    saveMyFoods(next);
  }

  const frequentOnly = frequent.filter((meal) => !savedKeys.has(foodKey(meal)));
  if (!myFoods.length && !frequentOnly.length) return null;

  const chip = (meal, saved) => (
    <div key={`${saved ? "my" : "fq"}-${foodKey(meal)}`} className="flex items-center gap-1 rounded-2xl bg-zinc-100 pl-3 dark:bg-zinc-800">
      <button className="min-w-0 flex-1 py-2 text-left text-sm" onClick={() => onLog(meal)} aria-label={`Quick add ${meal.name}`}>
        <span className="block truncate font-semibold">{meal.name}</span>
        <span className="text-xs text-zinc-500">{meal.calories} kcal{meal.timesLogged > 1 ? ` · ${meal.timesLogged}×` : ""}</span>
      </button>
      <button className="p-2" onClick={() => toggleSaved(meal)} aria-label={saved ? `Remove ${meal.name} from My foods` : `Save ${meal.name} to My foods`} aria-pressed={saved}>
        <Star className={saved ? "h-4 w-4 fill-amber-400 text-amber-400" : "h-4 w-4 text-zinc-400"} />
      </button>
    </div>
  );

  return (
    <div className="mt-4" data-testid="quick-add">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Quick add</p>
      <div className="grid grid-cols-2 gap-2">
        {myFoods.map((meal) => chip(meal, true))}
        {frequentOnly.map((meal) => chip(meal, false))}
      </div>
    </div>
  );
}

// Packaged food by barcode, using Open Food Facts open data.
export function BarcodeLookup({ onFill }) {
  const [code, setCode] = useState("");
  const [product, setProduct] = useState(null);
  const [grams, setGrams] = useState("100");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function find(value) {
    const clean = String(value || "").trim();
    setProduct(null);
    if (!isValidBarcode(clean)) {
      setStatus("Enter or scan an 8–14 digit barcode.");
      return;
    }
    setBusy(true);
    setStatus("Looking up…");
    try {
      const found = await lookupBarcode(clean);
      if (!found) {
        setStatus("Not found in Open Food Facts. Enter the values from the label instead.");
      } else {
        setProduct(found);
        setGrams(String(found.servingGrams || 100));
        setStatus(found.per100g.calories === null ? "Found, but calories are missing for this product." : "");
      }
    } catch (error) {
      setStatus(error.message || "Lookup failed.");
    } finally {
      setBusy(false);
    }
  }

  async function scan() {
    try {
      // Loaded on demand: the plugin bundles a large web scanner we don't need up front.
      const { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } = await import("@capacitor/barcode-scanner");
      const result = await CapacitorBarcodeScanner.scanBarcode({ hint: CapacitorBarcodeScannerTypeHint.ALL, scanInstructions: "Point at the barcode" });
      if (result?.ScanResult) {
        setCode(result.ScanResult);
        find(result.ScanResult);
      }
    } catch (error) {
      if (!String(error?.message || "").toLowerCase().includes("cancel")) setStatus("Couldn't scan. Type the numbers under the barcode instead.");
    }
  }

  const values = product ? nutritionForGrams(product, grams) : null;

  return (
    <div className="space-y-2" data-testid="barcode-lookup">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input className="field" inputMode="numeric" placeholder="Barcode number" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-label="Barcode number" />
        <Button variant="secondary" onClick={() => find(code)} disabled={busy} className="rounded-2xl">Look up</Button>
      </div>
      {Capacitor.isNativePlatform() && (
        <Button variant="secondary" onClick={scan} className="w-full rounded-2xl py-3"><ScanBarcode className="mr-2 h-4 w-4" />Scan barcode</Button>
      )}
      {status && <p className="text-sm text-zinc-500" role="status">{status}</p>}
      {product && (
        <div className="rounded-2xl bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
          <p className="font-bold">{product.name}</p>
          {product.servingSize && <p className="text-xs text-zinc-500">Serving on label: {product.servingSize}</p>}
          <label className="mt-2 flex items-center gap-2">
            <span className="text-zinc-500">Amount (g)</span>
            <input className="field !mb-0 w-24" type="number" value={grams} onChange={(e) => setGrams(e.target.value)} aria-label="Amount in grams" />
          </label>
          <p className="mt-2">{values.calories || "?"} kcal · {values.protein_g || 0}g protein · {values.sugar_g || 0}g sugar</p>
          <Button onClick={() => onFill({ name: product.name, ...values })} className="mt-2 w-full rounded-2xl bg-[hsl(24_80%_58%)] text-white">Use in meal form</Button>
          <p className="mt-2 text-[11px] text-zinc-400">Data from Open Food Facts (ODbL). Check it against the label.</p>
        </div>
      )}
    </div>
  );
}

// AI food-photo estimate. Hidden behind configuration; values are editable
// approximations, never saved without the user reviewing them.
export function AiEstimate({ photoRef, onFill }) {
  const [note, setNote] = useState("");
  const [estimate, setEstimate] = useState(null);
  const [fields, setFields] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isAiNutritionEnabled) {
    return <p className="mt-2 text-xs text-zinc-500">AI photo estimates turn on when Xlife Cloud and the AI function are set up (see docs/SETUP.md). You can still attach the photo and type the values.</p>;
  }
  if (!photoRef) return null;

  async function run() {
    setBusy(true);
    setStatus("Estimating…");
    try {
      const result = await estimateNutritionFromPhoto(photoRef, note);
      setEstimate(result);
      if (!result.is_food) {
        setStatus("That doesn't look like food.");
        setFields(null);
      } else {
        setStatus("");
        setFields({
          name: result.items.map((item) => item.name).join(", ").slice(0, 80),
          calories: Math.round(result.total.calories),
          protein_g: Math.round(result.total.protein_g),
          sugar_g: Math.round(result.total.sugar_g),
        });
      }
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <input className="field" placeholder="Optional: what's in it / portion (helps accuracy)" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button onClick={run} disabled={busy} className="w-full rounded-2xl bg-purple-500 py-3 text-white"><Sparkles className="mr-2 h-4 w-4" />Estimate with AI</Button>
      {status && <p className="text-sm text-zinc-500" role="status">{status}</p>}
      {fields && (
        <div className="rounded-2xl bg-purple-50 p-3 text-sm dark:bg-purple-500/10">
          <p className="text-xs font-black uppercase tracking-wider text-purple-600">Approximate · {estimate.confidence} confidence</p>
          <input className="field mt-2" value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} aria-label="Estimated meal name" />
          <div className="grid grid-cols-3 gap-2">
            {[["calories", "kcal"], ["protein_g", "protein g"], ["sugar_g", "sugar g"]].map(([key, label]) => (
              <label key={key} className="text-xs text-zinc-500">{label}
                <input className="field" type="number" value={fields[key]} onChange={(e) => setFields({ ...fields, [key]: e.target.value })} />
              </label>
            ))}
          </div>
          {estimate.notes && <p className="text-xs text-zinc-500">{estimate.notes}</p>}
          <Button onClick={() => onFill(fields)} className="mt-2 w-full rounded-2xl bg-[hsl(24_80%_58%)] text-white">Use these values</Button>
          <p className="mt-1 text-[11px] text-zinc-400">AI estimates can be off by 20% or more — hidden oil and portion size matter. Edit before saving.</p>
        </div>
      )}
    </div>
  );
}
