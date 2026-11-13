import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, ImagePlus, Star } from "lucide-react";
import { readLocalJSON, writeLocalJSON, createId } from "../lib/storage";
import { isNativeCamera, captureNativePhoto, chooseNativePhoto, fileToPersistentDataUrl, isPermissionDenied } from "../lib/photos";
import { Button } from "../components/ui.jsx";
import { todayISO } from "../lib/dates";
import { getMealTypeForNow } from "../lib/food";
import { getMemoryStreak, getAllMemorySnaps } from "../lib/dailyLog";
import { classNames } from "../lib/utils";


const emptyFoodForm = { meal_type: getMealTypeForNow(), name: "", calories: "", protein_g: "", sugar_g: "", cost: "", rating: 0, notes: "" };
const emptySpendingForm = { item_name: "", amount: "", category: "Food", merchant: "", notes: "" };
export 
function Snaps({ log, setLog, pendingSnap, setPendingSnap }) {
  // `pendingSnap` is owned by AppShell (and mirrored to localStorage) so the
  // review screen cannot be lost if this component remounts while the native
  // camera is open. This was the cause class behind "the first photo after
  // launch sometimes skips the Save Memory / Mark Food / Track Spending screen".
  const preview = pendingSnap?.url || "";
  const [caption, setCaption] = useState("");
  const [cameraFacing, setCameraFacing] = useState("rear");
  const [captureMode, setCaptureMode] = useState("memory");
  const [foodForm, setFoodForm] = useState(() => ({ ...emptyFoodForm, meal_type: getMealTypeForNow() }));
  const [spendingForm, setSpendingForm] = useState(emptySpendingForm);
  const [spendingSavedMessage, setSpendingSavedMessage] = useState("");
  const [spendingRecords, setSpendingRecords] = useState(() => readLocalJSON("dayflow_spending", []));
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const capturingRef = useRef(false);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const reviewRef = useRef(null);
  const todaySnaps = log.snaps.filter((snap) => (!snap.date || snap.date === todayISO) && (!snap.type || snap.type === "memory"));
  const memoryStreak = useMemo(() => getMemoryStreak(getAllMemorySnaps(log)), [log]);
  const todaySpendingTotal = spendingRecords
    .filter((record) => record.date === todayISO)
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);

  useEffect(() => {
    writeLocalJSON("dayflow_spending", spendingRecords);
  }, [spendingRecords]);

  // Bring the three-option review panel into view as soon as a photo arrives.
  useEffect(() => {
    if (preview) {
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [preview]);

  function showCapturedPhoto(url, source) {
    if (!url) return;
    resetCaptureForms();
    setSaveMessage("");
    setPendingSnap({ url, source, captured_at: new Date().toISOString() });
  }

  async function runCapture(kind) {
    // Guard against double taps / re-entry while the native UI is opening.
    if (capturingRef.current) return;
    setCaptureError("");

    if (!isNativeCamera()) {
      // Web / dev fallback: the browser's own camera or file picker.
      (kind === "camera" ? cameraInputRef : galleryInputRef).current?.click();
      return;
    }

    capturingRef.current = true;
    setCapturing(true);
    try {
      const url = kind === "camera"
        ? await captureNativePhoto({ facing: cameraFacing })
        : await chooseNativePhoto();
      if (url) showCapturedPhoto(url, kind);
    } catch (error) {
      console.error("[xlife] capture failed", error);
      setCaptureError(isPermissionDenied(error)
        ? "Xlife doesn't have permission. Allow Camera and Photos for Xlife in iPhone Settings, then try again."
        : "Couldn't get that photo. Please try again.");
    } finally {
      capturingRef.current = false;
      setCapturing(false);
    }
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setCapturing(true);
    try {
      const url = await fileToPersistentDataUrl(file);
      showCapturedPhoto(url, "upload");
    } catch (error) {
      console.error("[xlife] upload failed", error);
      setCaptureError("Couldn't read that photo. Please try another one.");
    } finally {
      setCapturing(false);
    }
  }

  function resetCaptureForms() {
    setCaption("");
    setCaptureMode("memory");
    setFoodForm({ ...emptyFoodForm, meal_type: getMealTypeForNow() });
    setSpendingForm(emptySpendingForm);
    setSpendingSavedMessage("");
  }

  function clearCapture() {
    setPendingSnap(null);
    resetCaptureForms();
  }

  function saveMemory() {
    if (!preview) return;
    setLog((current) => ({
      ...current,
      snaps: [
        ...(current.snaps || []),
        {
          id: createId(),
          url: preview,
          caption: caption || "An Xlife moment",
          date: todayISO,
          taken_at: new Date().toISOString(),
          type: "memory",
        },
      ],
    }));
    clearCapture();
    setSaveMessage("Memory saved. It's on Home under Today's snaps.");
  }

  function selectCaptureMode(mode) {
    setCaptureMode(mode);
  }

  function saveFoodMeal() {
    if (!preview) return;
    if (!foodForm.name.trim()) {
      setCaptureError("Add the food name before saving the meal.");
      return;
    }
    setCaptureError("");
    const now = new Date();
    const nextMeal = {
      id: createId(),
      date: todayISO,
      type: foodForm.meal_type,
      source: "snap",
      image_url: preview,
      photo_url: preview,
      meal_type: foodForm.meal_type,
      name: foodForm.name.trim(),
      calories: Number(foodForm.calories || 0),
      protein_g: Number(foodForm.protein_g || 0),
      sugar_g: Number(foodForm.sugar_g || 0),
      cost: Number(foodForm.cost || 0),
      rating: Number(foodForm.rating || 0),
      notes: foodForm.notes,
      time: now.toTimeString().slice(0, 5),
      createdAt: now.toISOString(),
    };
    const history = readLocalJSON("dayflow_meal_history", []);

    setLog((current) => ({ ...current, meals: [...(current.meals || []), nextMeal] }));
    // Meal history keeps the nutrition data for recommendations; the photo
    // itself is stored once (in today's log) to save space.
    writeLocalJSON("dayflow_meal_history", [...history, { ...nextMeal, image_url: "", photo_url: "" }]);
    clearCapture();
    setSaveMessage(`Meal saved: ${nextMeal.name}.`);
  }

  function saveSpending() {
    if (!preview) return;
    if (!spendingForm.item_name.trim() || !spendingForm.amount) {
      setCaptureError("Add what you bought and the amount before saving.");
      return;
    }
    setCaptureError("");
    const nextSpending = {
      id: createId(),
      date: todayISO,
      image_url: preview,
      item_name: spendingForm.item_name,
      amount: Number(spendingForm.amount || 0),
      category: spendingForm.category,
      merchant: spendingForm.merchant,
      notes: spendingForm.notes,
      createdAt: new Date().toISOString(),
    };

    setSpendingRecords((current) => [...current, nextSpending]);
    // Clear the review like Save Memory / Save meal do; previously the form
    // stayed open and a second tap saved a duplicate record.
    clearCapture();
    setSaveMessage(`Saved. You spent $${nextSpending.amount.toFixed(2)} on ${nextSpending.item_name}.`);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={classNames(
        "-mx-4 -mt-2 bg-zinc-950 px-4 pb-4 pt-3 text-white",
        preview ? "min-h-[calc(100dvh-11rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]" : "h-[calc(100dvh-11rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-hidden"
      )}
    >
      <input ref={cameraInputRef} type="file" accept="image/*" capture={cameraFacing === "front" ? "user" : "environment"} className="hidden" onChange={handleFileUpload} />
      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
      <div className={classNames("mx-auto flex max-w-md flex-col", preview ? "" : "h-full")}>
        <div className="flex items-center justify-between">
          <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold backdrop-blur-xl">
            🔥 {memoryStreak > 1 ? `${memoryStreak}-day streak · ` : ""}{todaySnaps.length} today
          </div>
          <button
            onClick={() => setCameraFacing(cameraFacing === "rear" ? "front" : "rear")}
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold backdrop-blur-xl transition hover:bg-white/20"
          >
            {cameraFacing === "rear" ? "Rear" : "Front"}
          </button>
        </div>

        <div className={classNames(
          "relative my-3 overflow-hidden rounded-[2rem] bg-black shadow-2xl ring-1 ring-white/10",
          preview ? "" : "min-h-0 flex-1"
        )}>
          <div className={classNames("w-full", preview ? "h-[38dvh]" : "h-full")}>
            {preview ? (
              <img src={preview} alt="Snap preview" className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-zinc-900 via-zinc-950 to-black px-8 text-center">
                <div className="mb-4 rounded-full bg-white/10 p-5">
                  <Camera className="h-10 w-10 text-white" />
                </div>
                <p className="text-lg font-bold">Ready for a snap</p>
                <p className="mt-2 text-sm text-zinc-400">
                  {capturing ? "Opening camera..." : "Tap the shutter to take a photo, or pick one from your gallery."}
                </p>
                {saveMessage && <p className="mt-4 rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white">{saveMessage}</p>}
                {captureError && <p className="mt-4 rounded-2xl bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-100">{captureError}</p>}
              </div>
            )}
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/65 to-transparent" />
        </div>

        {preview ? (
          <div ref={reviewRef} className="space-y-3 rounded-[2rem] bg-white p-4 text-zinc-900 shadow-2xl dark:bg-zinc-900 dark:text-white">
            {captureError && <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-200">{captureError}</p>}
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

                <p className="rounded-3xl bg-[hsl(160_50%_45%)]/10 p-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  AI photo recognition isn't connected yet, so enter the food and your best estimate. Values are approximate.
                </p>
                <input className="field" placeholder="Food name" value={foodForm.name} onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })} />
                <div className="grid grid-cols-3 gap-2">
                  <input className="field" placeholder="Calories" type="number" inputMode="numeric" value={foodForm.calories} onChange={(e) => setFoodForm({ ...foodForm, calories: e.target.value })} />
                  <input className="field" placeholder="Protein g" type="number" inputMode="decimal" value={foodForm.protein_g} onChange={(e) => setFoodForm({ ...foodForm, protein_g: e.target.value })} />
                  <input className="field" placeholder="Sugar g" type="number" inputMode="decimal" value={foodForm.sugar_g} onChange={(e) => setFoodForm({ ...foodForm, sugar_g: e.target.value })} />
                </div>

                <input className="field" placeholder="Cost" type="number" inputMode="decimal" value={foodForm.cost} onChange={(e) => setFoodForm({ ...foodForm, cost: e.target.value })} />

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
                <Button onClick={saveFoodMeal} className="w-full rounded-2xl bg-[hsl(24_80%_58%)] py-3 text-white">Save meal</Button>
              </div>
            )}

            {captureMode === "spending" && (
              <div className="space-y-2">
                <input className="field" placeholder="Item / what I bought" value={spendingForm.item_name} onChange={(e) => setSpendingForm({ ...spendingForm, item_name: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="field" placeholder="Amount spent" type="number" inputMode="decimal" value={spendingForm.amount} onChange={(e) => setSpendingForm({ ...spendingForm, amount: e.target.value })} />
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
          <div className="relative flex shrink-0 items-center justify-center pb-1">
            <button
              onClick={() => runCapture("gallery")}
              disabled={capturing}
              className="absolute left-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-xl transition hover:bg-white/20 disabled:opacity-50"
              aria-label="Choose from gallery"
            >
              <ImagePlus className="h-6 w-6" />
            </button>

            <button
              onClick={() => runCapture("camera")}
              disabled={capturing}
              className="h-20 w-20 rounded-full border-4 border-white bg-white shadow-[0_0_0_8px_rgba(255,255,255,0.16)] transition active:scale-95 disabled:opacity-60"
              aria-label="Take photo"
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
