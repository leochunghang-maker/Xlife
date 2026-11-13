import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Utensils, Sparkles, Trash2, Plus, ImagePlus, Star } from "lucide-react";
import { readLocalJSON, writeLocalJSON, createId } from "../lib/storage";
import { fileToPersistentDataUrl } from "../lib/photos";
import { Button, SoftCard, SectionTitle } from "../components/ui.jsx";
import { todayISO } from "../lib/dates";
import { mealSuggestions, defaultRestaurants, createRestaurantRecord, cuisineCategories, normalizeText, suggestionKey, getMealTypeForNow, getCuisineFallbackRestaurant, getSmartFoodSuggestions } from "../lib/food";
import { classNames } from "../lib/utils";

export 
function Meals({ log, setLog }) {
  const [form, setForm] = useState({ type: "breakfast", name: "", calories: "", protein_g: "", sugar_g: "", rating: 5, cost: "" });
  const [suggestions, setSuggestions] = useState([]);
  const [catalogTab, setCatalogTab] = useState("browse");
  const [restaurantSearch, setRestaurantSearch] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("");
  const [suggestionRefreshSeed, setSuggestionRefreshSeed] = useState(0);
  const [rejectedFoodSuggestions, setRejectedFoodSuggestions] = useState(() => readLocalJSON("dayflow_rejected_food_suggestions", []));
  const [savedFoodSuggestions, setSavedFoodSuggestions] = useState(() => readLocalJSON("dayflow_saved_food_suggestions", []));
  const [mealHistory, setMealHistory] = useState(() => readLocalJSON("dayflow_meal_history", []));
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
    const savedRestaurants = readLocalJSON("dayflow_restaurants", null);
    const seededRestaurants = Array.isArray(savedRestaurants)
      ? savedRestaurants.map(createRestaurantRecord)
      : defaultRestaurants.map(createRestaurantRecord);
    if (!savedRestaurants) {
      writeLocalJSON("dayflow_restaurants", seededRestaurants);
    }
    return seededRestaurants;
  });

  useEffect(() => {
    writeLocalJSON("dayflow_restaurants", restaurantCatalog);
  }, [restaurantCatalog]);

  useEffect(() => {
    writeLocalJSON("dayflow_meal_history", mealHistory);
  }, [mealHistory]);

  useEffect(() => {
    writeLocalJSON("dayflow_rejected_food_suggestions", rejectedFoodSuggestions);
  }, [rejectedFoodSuggestions]);

  useEffect(() => {
    writeLocalJSON("dayflow_saved_food_suggestions", savedFoodSuggestions);
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

  const [mealMessage, setMealMessage] = useState("");

  // Logs one meal to today's log and to meal history (history copy has no
  // photo, so images are not stored twice).
  function logMeal(fields) {
    const now = new Date();
    const nextMeal = {
      id: createId(),
      date: todayISO,
      type: fields.type || form.type,
      meal_type: fields.type || form.type,
      name: fields.name,
      calories: Number(fields.calories || 0),
      protein_g: Number(fields.protein_g || 0),
      sugar_g: Number(fields.sugar_g || 0),
      cost: Number(fields.cost || 0),
      rating: Number(fields.rating || 0),
      cuisine: fields.cuisine || "",
      restaurant_name: fields.restaurant_name || "",
      notes: fields.notes || "",
      photo_url: fields.photo_url || "",
      time: now.toTimeString().slice(0, 5),
      createdAt: now.toISOString(),
    };
    setLog((current) => ({ ...current, meals: [...(current.meals || []), nextMeal] }));
    setMealHistory((current) => [...current, { ...nextMeal, photo_url: "" }]);
    setMealMessage(`Added ${nextMeal.name} to today's ${nextMeal.type}.`);
    return nextMeal;
  }

  function addMeal() {
    if (!form.name.trim() || form.calories === "") {
      setMealMessage("Add a meal name and calories first.");
      return;
    }
    logMeal({ ...form, name: form.name.trim() });
    setForm({ ...form, name: "", calories: "", protein_g: "", sugar_g: "", cost: "", photo_url: "", cuisine: "", restaurant_name: "" });
    setFoodPhotoPreview("");
  }

  function removeMeal(meal, index) {
    setLog((current) => ({ ...current, meals: (current.meals || []).filter((item, i) => (meal.id ? item.id !== meal.id : i !== index)) }));
    // Keep recommendations/history consistent with the deletion.
    if (meal.id) setMealHistory((current) => current.filter((item) => item.id !== meal.id));
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
    const restaurant = restaurantCatalog.find((item) => item.id === restaurantId);
    if (!window.confirm(`Delete ${restaurant?.name || "this restaurant"} and its notes/photos?`)) return;
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

  // "Add to meal" used to only pre-fill the form at the top of the page, so
  // nothing visibly happened. It now logs the item directly.
  function addMenuItemToMeal(item, restaurant = {}) {
    logMeal({
      ...item,
      rating: item.rating || form.rating,
      cuisine: restaurant.cuisine,
      restaurant_name: restaurant.name,
      photo_url: "",
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
      id: suggestion.item?.id || createId(),
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

  // Previously this pre-filled the form AND wrote the whole suggestion object
  // (including nested restaurant photos) into meal history as if it had been
  // eaten, without adding it to today's meals. Now it logs one clean meal.
  function addCatalogSuggestionToMeal(suggestion) {
    if (!suggestion) return;
    logMeal({
      name: suggestion.name,
      calories: suggestion.calories,
      protein_g: suggestion.protein_g,
      sugar_g: suggestion.sugar_g,
      cost: suggestion.cost,
      rating: suggestion.rating,
      cuisine: suggestion.cuisine,
      restaurant_name: suggestion.restaurant_name === "Meal history" ? "" : suggestion.restaurant_name,
    });
  }

  function refreshFoodSuggestions() {
    setSuggestionRefreshSeed((seed) => seed + 1);
  }

  function isSuggestionSaved(suggestion) {
    return Boolean(suggestion?.saved || savedFoodSuggestions.some((item) => item.key === suggestion?.key));
  }

  // Photos are compressed to JPEG data URLs before saving so they persist and
  // do not exhaust the WebView's localStorage quota.
  async function handleRestaurantPhotoUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const photoUrl = await fileToPersistentDataUrl(file).catch(() => "");
    if (photoUrl) setRestaurantForm((current) => ({ ...current, photo_url: photoUrl }));
  }

  async function handleFoodPhotoUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const photoUrl = await fileToPersistentDataUrl(file).catch(() => "");
    if (!photoUrl) return;
    setFoodPhotoPreview(photoUrl);
    setForm((current) => ({ ...current, photo_url: photoUrl }));
  }

  return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
    <SoftCard>
      <SectionTitle icon={Utensils} title="Log a meal" />
      {mealMessage && <p className="mb-3 rounded-2xl bg-[hsl(160_50%_45%)]/10 p-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200" role="status">{mealMessage}</p>}
      <div className="grid grid-cols-4 gap-2 mb-3">{['breakfast','lunch','dinner','snack'].map(t => <button key={t} onClick={() => setForm({ ...form, type: t })} className={classNames("rounded-2xl py-2 text-xs capitalize", form.type === t ? "bg-[hsl(24_80%_58%)] text-white" : "bg-zinc-100 dark:bg-zinc-800")}>{t}</button>)}</div>
      <input className="field" placeholder="Meal name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <div className="grid grid-cols-3 gap-2"><input className="field" placeholder="Calories" type="number" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} /><input className="field" placeholder="Protein g" type="number" value={form.protein_g} onChange={(e) => setForm({ ...form, protein_g: e.target.value })} /><input className="field" placeholder="Sugar g" type="number" value={form.sugar_g} onChange={(e) => setForm({ ...form, sugar_g: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-2"><input className="field" placeholder="Cost" type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /><select className="field" value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n} stars</option>)}</select></div>
      <div className="flex gap-2 mt-2"><Button onClick={addMeal} className="flex-1 rounded-2xl bg-[hsl(24_80%_58%)]"><Plus className="h-4 w-4 mr-1" /> Add</Button><Button variant="secondary" className="rounded-2xl" onClick={() => setSuggestions(smartFoodSuggestions.length ? smartFoodSuggestions.slice(0, 4) : mealSuggestions[form.type].map((item) => ({ ...item, key: suggestionKey(item.name), reason: "Starter idea until Xlife learns more from your meals." })))}>Ideas</Button></div>
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
            <p className="font-bold">Search your restaurants</p>
            <p className="mt-1 text-xs text-zinc-500">Searches restaurants you have saved on this phone. Live nearby search is not connected yet.</p>
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
                <p className="text-xs font-bold uppercase text-[hsl(160_50%_45%)]">Smart pick</p>
                <p className="text-lg font-black">Recommended for you</p>
              </div>
              <Button variant="secondary" onClick={refreshFoodSuggestions} className="rounded-2xl px-3 py-2 text-xs">
                Refresh suggestions
              </Button>
            </div>
            <p className="mb-3 text-sm text-zinc-500">
              Ranked on this phone from your meals, ratings, rejections, and saved favorites. Not live restaurant data.
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
                        Menu idea
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
                  <Button variant="secondary" size="icon" aria-label={`Delete ${restaurant.name}`} onClick={() => deleteRestaurant(restaurant.id)}>
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
                          <Button variant="secondary" size="icon" aria-label={`Delete ${item.name}`} onClick={() => deleteMenuItem(restaurant.id, item.id)}>
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
      <div className="space-y-2">{log.meals.length === 0 && <p className="text-sm text-zinc-500">No meals logged today yet.</p>}{log.meals.map((meal, i) => <div key={meal.id || i} className="flex items-center justify-between rounded-2xl bg-zinc-100 dark:bg-zinc-800 p-3"><div><p className="font-semibold">{meal.name}</p><p className="text-xs text-zinc-500 capitalize">{meal.meal_type || meal.type} · {meal.calories} kcal</p></div><div className="flex gap-2"><Button variant="secondary" size="icon" aria-label={`Remove ${meal.name}`} onClick={() => removeMeal(meal, i)}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>
    </SoftCard>
  </motion.div>;
}
