import { useState } from "react";
import { readLocalJSON, writeLocalJSON, createId } from "../lib/storage";
import { Button } from "../components/ui.jsx";
import { cuisineCategories, normalizeText } from "../lib/food";
import { classNames } from "../lib/utils";
import { toggleListValue } from "../lib/cycle";
import { isSupabaseConfigured } from "../lib/supabase";
import { cloudSignUp, cloudSignIn, restoreFromCloud } from "../lib/cloud";

export function Onboarding({ onAuthenticated }) {
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

  const existingUser = readLocalJSON("dayflow_user", null);

  const [busy, setBusy] = useState(false);

  async function createAccount() {
    if (existingUser) {
      setAuthError(`This phone already has an Xlife profile for ${existingUser.email || existingUser.name || "another account"}. Sign in instead — creating a new account here would hide that profile's data.`);
      return;
    }
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      setAuthError("Add your name, email, and password to create your account.");
      return;
    }

    let cloudUserId = null;
    if (isSupabaseConfigured) {
      // Real account in Xlife Cloud. The password goes only to Supabase Auth.
      setBusy(true);
      const { data, error } = await cloudSignUp({ email: createForm.email.trim(), password: createForm.password, name: createForm.name.trim() });
      setBusy(false);
      if (error) {
        setAuthError(error.message || "Couldn't create your cloud account.");
        return;
      }
      cloudUserId = data?.user?.id || null;
    }

    const user = {
      id: cloudUserId || createId(),
      name: createForm.name.trim(),
      email: createForm.email.trim(),
      birthday: createForm.birthday,
      gender: createForm.gender,
      profile_photo_url: "",
      createdAt: new Date().toISOString(),
    };

    writeLocalJSON("dayflow_user", user);
    setCreatedUser(user);
    setAuthError("");
    setScreen("profile");
  }

  async function signIn() {
    if (isSupabaseConfigured) {
      setBusy(true);
      const { data, error } = await cloudSignIn({ email: signInForm.email.trim(), password: signInForm.password });
      setBusy(false);
      if (error) {
        setAuthError(error.message || "Couldn't sign in.");
        return;
      }
      const localUser = readLocalJSON("dayflow_user", null);
      if (localUser && normalizeText(localUser.email) !== normalizeText(signInForm.email)) {
        setAuthError(`This phone already has an Xlife profile for ${localUser.email}. Sign in with that account.`);
        return;
      }
      const cloudUser = data.user;
      const profile = localUser || {
        id: cloudUser.id,
        name: cloudUser.user_metadata?.name || signInForm.email.split("@")[0],
        email: cloudUser.email,
        profile_photo_url: "",
        createdAt: new Date().toISOString(),
      };
      if (!localUser) writeLocalJSON("dayflow_user", profile);
      // Bring down anything this phone doesn't have yet (never overwrites).
      restoreFromCloud().catch((restoreError) => console.warn("[xlife] restore failed", restoreError));
      localStorage.setItem("dayflow_active_session", "true");
      setAuthError("");
      onAuthenticated(profile);
      return;
    }
    // Local-only mode: profiles live on this phone and have no password
    // (use the Face ID lock in Settings to protect the app).
    const savedUser = readLocalJSON("dayflow_user", null);
    if (!savedUser || normalizeText(savedUser.email) !== normalizeText(signInForm.email)) {
      setAuthError("We could not find that email yet. Create an account first or check the address.");
      return;
    }

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
              {existingUser && (
                <div className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                  <p>A profile for {existingUser.email || existingUser.name} is already saved on this phone.</p>
                  <Button variant="secondary" onClick={() => { setSignInForm({ ...signInForm, email: existingUser.email || "" }); setScreen("signin"); setAuthError(""); }} className="mt-2 w-full rounded-2xl">
                    Sign in instead
                  </Button>
                </div>
              )}
              {authError && <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-600">{authError}</p>}
              <Button onClick={createAccount} disabled={busy} className="w-full rounded-2xl bg-[hsl(24_80%_58%)] py-4 text-white">
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
              <Button onClick={signIn} disabled={busy} className="w-full rounded-2xl bg-[hsl(24_80%_58%)] py-4 text-white">
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
              <label className="block text-sm font-bold text-zinc-500" htmlFor="onboarding-wake">Usual wake-up time</label>
              <input id="onboarding-wake" className="field" type="time" value={preferences.preferred_wake_time} onChange={(e) => setPreferences({ ...preferences, preferred_wake_time: e.target.value })} />
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
                <p className="mt-1 text-sm text-zinc-500">{isSupabaseConfigured ? "After setup, pair for real in Settings → Xlife Cloud (invite codes work across phones). Codes below are saved on this phone only." : "Real pairing between two phones needs Xlife Cloud, which isn't configured in this build. Codes are saved on this phone only."}</p>
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
