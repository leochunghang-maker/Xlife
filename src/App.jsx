import { isSupabaseConfigured } from "./lib/supabase";
import { AppLockGate } from "./components/AppLockGate.jsx";
import { useEffect, useState } from "react";
import { readLocalJSON, writeLocalJSON } from "./lib/storage";
import { Onboarding } from "./features/Onboarding.jsx";
import { AppShell } from "./features/AppShell.jsx";


export default function App() {
  const [user, setUser] = useState(() => {
    const savedUser = readLocalJSON("dayflow_user", null);
    const activeSession = localStorage.getItem("dayflow_active_session");

    if (savedUser && activeSession !== "false") {
      localStorage.setItem("dayflow_active_session", "true");
      return savedUser;
    }
    return null;
  });

  // From local-latest: with Xlife Cloud on, restore a signed-in Supabase
  // session on launch when this phone has no active local profile.
  const [authLoading, setAuthLoading] = useState(() => isSupabaseConfigured && !user);

  useEffect(() => {
    if (!authLoading) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { getCloudSession } = await import("./lib/cloud");
        const session = await getCloudSession();
        if (cancelled || !session?.user) return;
        const localUser = readLocalJSON("dayflow_user", null);
        const sameAccount = localUser && (localUser.id === session.user.id
          || String(localUser.email || "").toLowerCase() === String(session.user.email || "").toLowerCase());
        if (localUser && !sameAccount) return; // never replace another local profile
        const restored = localUser || {
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Xlife user",
          email: session.user.email || "",
          profile_photo_url: "",
          createdAt: session.user.created_at || new Date().toISOString(),
        };
        writeLocalJSON("dayflow_user", restored);
        localStorage.setItem("dayflow_active_session", "true");
        setUser(restored);
      } catch (error) {
        console.warn("[xlife] session restore failed", error);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading]);

  function handleAuthenticated(nextUser) {
    setUser(nextUser);
  }

  function handleLogout() {
    if (!window.confirm("Log out of Xlife? Your data stays on this phone.")) return;
    if (isSupabaseConfigured) import("./lib/cloud").then(({ cloudSignOut }) => cloudSignOut()).catch(() => {});
    localStorage.setItem("dayflow_active_session", "false");
    setUser(null);
  }

  if (authLoading) {
    return (
      <div className="safe-bottom safe-top flex min-h-screen items-center justify-center bg-[hsl(30_30%_98%)] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="rounded-3xl bg-white p-5 text-center shadow-sm dark:bg-zinc-900">
          <h1 className="text-2xl font-black">Xlife</h1>
          <p className="mt-1 text-sm text-zinc-500">Loading your flow...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Onboarding onAuthenticated={handleAuthenticated} />;
  }

  return (
    <AppLockGate>
      <AppShell user={user} onLogout={handleLogout} />
    </AppLockGate>
  );
}
