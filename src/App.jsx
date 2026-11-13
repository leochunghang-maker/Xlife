import { isSupabaseConfigured } from "./lib/supabase";
import { AppLockGate } from "./components/AppLockGate.jsx";
import { useState } from "react";
import { readLocalJSON } from "./lib/storage";
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

  function handleAuthenticated(nextUser) {
    setUser(nextUser);
  }

  function handleLogout() {
    if (!window.confirm("Log out of Xlife? Your data stays on this phone.")) return;
    if (isSupabaseConfigured) import("./lib/cloud").then(({ cloudSignOut }) => cloudSignOut()).catch(() => {});
    localStorage.setItem("dayflow_active_session", "false");
    setUser(null);
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
