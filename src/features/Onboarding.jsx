import { useState } from "react";
import { readLocalJSON, writeLocalJSON, createId } from "../lib/storage";
import { Button } from "../components/ui.jsx";
import { cuisineCategories, normalizeText } from "../lib/food";
import { classNames } from "../lib/utils";
import { toggleListValue } from "../lib/cycle";

export 
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
      id: createId(),
      name: createForm.name.trim(),
      email: createForm.email.trim(),
      birthday: createForm.birthday,
      gender: createForm.gender,
      profile_photo_url: "",
      createdAt: new Date().toISOString(),
    };

    // Future Supabase Auth: replace this localStorage write with signUp() and a profiles insert.
    writeLocalJSON("dayflow_user", user);
    setCreatedUser(user);
    setAuthError("");
    setScreen("profile");
  }

  function signIn() {
    const savedUser = readLocalJSON("dayflow_user", null);
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
    const savedUser = createdUser || readLocalJSON("dayflow_user", null);
    if (!savedUser) return;

    writeLocalJSON("dayflow_user_preferences", {
      ...preferences,
      daily_calorie_goal: Number(preferences.daily_calorie_goal || 0),
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem("dayflow_active_session", "true");

    if (preferences.relationship_mode === "Couple") {
      setScreen("partner");
      return;
    }

    onAuthenticated(savedUser);
  }

  function generateInviteCode() {
    const code = `XL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const connection = {
      inviteCode: code,
      partnerName: null,
      connected: false,
      createdAt: new Date().toISOString(),
    };

    writeLocalJSON("dayflow_partner_connection", connection);
    setInviteCode(code);
  }

  function finishPartnerSetup() {
    const savedUser = createdUser || readLocalJSON("dayflow_user", null);
    if (partnerCode.trim()) {
      writeLocalJSON("dayflow_partner_connection", {
        inviteCode: partnerCode.trim(),
        partnerName: null,
        connected: false,
        createdAt: new Date().toISOString(),
      });
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
                <h1 className="mt-2 text-5xl font-black tracking-tight">Xlife</h1>
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
                <p className="mt-1 text-sm text-zinc-500">Start your personal Xlife space.</p>
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
                <p className="mt-1 text-sm text-zinc-500">Sign in to your saved Xlife profile on this phone.</p>
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
                <p className="mt-1 text-sm text-zinc-500">A few preferences make Xlife feel more like you.</p>
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
                <p className="mt-1 text-sm text-zinc-500">Real pairing between two phones isn't available yet (it needs the planned cloud backend). Codes are saved on this phone only.</p>
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
                {partnerCode.trim() ? "Save code and continue" : "Skip for now"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
