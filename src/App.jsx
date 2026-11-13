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
    // Future Supabase Auth: replace this with supabase.auth.signOut().
    localStorage.setItem("dayflow_active_session", "false");
    setUser(null);
  }

  if (!user) {
    return <Onboarding onAuthenticated={handleAuthenticated} />;
  }

  return <AppShell user={user} onLogout={handleLogout} />;
}
