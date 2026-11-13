import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutDashboard, Utensils, Camera, Sparkles, HeartPulse, Settings as SettingsIcon } from "lucide-react";
import { readLocalJSON, writeLocalJSON, localDateISO, STORAGE_ERROR_EVENT } from "../lib/storage";
import { Button } from "../components/ui.jsx";
import { todayISO } from "../lib/dates";
import { hasDirtyForms } from "../lib/dirtyForms";
import { loadTodayLog } from "../lib/dailyLog";
import { classNames } from "../lib/utils";
import { Dashboard } from "./Dashboard.jsx";
import { Meals } from "./Meals.jsx";
import { Snaps } from "./Snaps.jsx";
import { Health } from "./Health.jsx";
import { Entertainment } from "./Entertainment.jsx";
import { Settings } from "./Settings.jsx";
import { maybeAutoBackup } from "../lib/cloudAuto";

export function AppShell({ user, onLogout }) {
  // Camera-first: the app opens on Snaps after sign-in / onboarding.
  const [route, setRoute] = useState("/snaps");
  const [log, setLog] = useState(loadTodayLog);
  const [storageWarning, setStorageWarning] = useState("");
  const [settingsFocus, setSettingsFocus] = useState(null);
  // The captured photo awaiting "Save Memory / Mark Food / Track Spending".
  // Owned here (not inside Snaps) and mirrored to localStorage so it survives a
  // Snaps remount or a WebView reload while the native camera was open.
  const [pendingSnap, setPendingSnapState] = useState(() => readLocalJSON("xlife_pending_snap", null));

  function setPendingSnap(nextSnap) {
    setPendingSnapState(nextSnap);
    if (nextSnap) {
      writeLocalJSON("xlife_pending_snap", nextSnap);
    } else {
      try {
        localStorage.removeItem("xlife_pending_snap");
      } catch {
        // ignore
      }
    }
  }

  // Persist today's log. Writes are debounced because the log can contain
  // several MB of photo data URLs and was being re-serialised on every
  // keystroke in Notes. Pending writes are flushed when the app is hidden,
  // closed, or this shell unmounts, so nothing is lost.
  const latestLogRef = useRef(log);
  const pendingWriteRef = useRef(null);
  useEffect(() => {
    latestLogRef.current = log;
    clearTimeout(pendingWriteRef.current);
    pendingWriteRef.current = setTimeout(() => {
      pendingWriteRef.current = null;
      writeLocalJSON("dayflow_log", latestLogRef.current);
    }, 250);
  }, [log]);

  useEffect(() => {
    function flush() {
      if (pendingWriteRef.current) {
        clearTimeout(pendingWriteRef.current);
        pendingWriteRef.current = null;
        writeLocalJSON("dayflow_log", latestLogRef.current);
      }
    }
    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        flush();
        localStorage.setItem("dayflow_last_active_at", new Date().toISOString());
        maybeAutoBackup();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  useEffect(() => {
    function handleStorageError() {
      setStorageWarning("Storage is full, so your latest change could not be saved on this device. Try removing a few photos, then save again.");
    }
    window.addEventListener(STORAGE_ERROR_EVENT, handleStorageError);
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, handleStorageError);
  }, []);

  // When the calendar day changes (app resumed on a new day, or left open past
  // midnight), reload so the day rolls over cleanly. Today's log is flushed
  // first. If the user is mid-way through typing a form, wait and show a
  // banner instead of wiping their input.
  const [newDayPending, setNewDayPending] = useState(false);
  useEffect(() => {
    function rollOver() {
      if (pendingWriteRef.current) {
        clearTimeout(pendingWriteRef.current);
        pendingWriteRef.current = null;
        writeLocalJSON("dayflow_log", latestLogRef.current);
      }
      window.location.reload();
    }
    function check() {
      if (localDateISO() === todayISO) return;
      if (hasDirtyForms()) setNewDayPending(true);
      else rollOver();
    }
    function handleVisibility() {
      if (document.visibilityState === "visible") check();
    }
    const interval = window.setInterval(check, 60 * 1000);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", check);
    };
  }, []);

  function navigate(path) {
    setRoute(path);
    window.scrollTo({ top: 0 });
  }

  const totalCalories = useMemo(
    () => log.meals.reduce((sum, meal) => sum + Number(meal.calories || 0), 0),
    [log.meals]
  );

  const totalProtein = useMemo(
    () => log.meals.reduce((sum, meal) => sum + Number(meal.protein_g || 0), 0),
    [log.meals]
  );

  const totalSugar = useMemo(
    () => log.meals.reduce((sum, meal) => sum + Number(meal.sugar_g || 0), 0),
    [log.meals]
  );

  const pageTitle = {
    "/": "Xlife",
    "/meals": "Meals",
    "/snaps": "Snaps",
    "/entertainment": "Fun",
    "/health": "Health",
  }[route];

  // Snaps is a full-screen black camera surface with no header (local-latest).
  const isSnapsRoute = route === "/snaps";

  return (
    <div className="min-h-screen overflow-x-hidden bg-[hsl(30_30%_98%)] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 font-sans">
      <div className={classNames(
        "mx-auto min-h-screen w-full max-w-2xl",
        isSnapsRoute ? "overflow-hidden bg-black" : "pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
      )}>
        {isSnapsRoute && <h1 className="sr-only">{pageTitle}</h1>}
        {!isSnapsRoute && <header className="sticky top-0 z-30 backdrop-blur-xl bg-[hsl(30_30%_98%)]/85 dark:bg-zinc-950/80 px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">
              {user?.name ? `hi, ${user.name.split(" ")[0]}` : "personal lifestyle"}
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              {pageTitle}
            </h1>
          </div>

          <Button variant="ghost" size="icon" className="rounded-2xl" onClick={() => setSettingsFocus("top")} aria-label="Settings">
            <SettingsIcon className="h-5 w-5" />
          </Button>
        </header>}

        <div className={isSnapsRoute ? "fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4rem)] z-40 mx-auto max-w-2xl" : ""}>
        {storageWarning && (
          <div className="mx-4 mb-3 flex items-start gap-3 rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200" role="alert">
            <p className="flex-1">{storageWarning}</p>
            <button onClick={() => setStorageWarning("")} className="shrink-0 font-bold" aria-label="Dismiss">✕</button>
          </div>
        )}

        {newDayPending && (
          <div className="mx-4 mb-3 flex items-center gap-3 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200" role="status">
            <p className="flex-1">A new day has started. Finish what you&apos;re typing, then start the new day.</p>
            <Button size="sm" variant="secondary" className="shrink-0 rounded-2xl" onClick={() => window.location.reload()}>Start new day</Button>
          </div>
        )}
        </div>

        <main className={isSnapsRoute ? "h-[100dvh] overflow-hidden bg-black" : "space-y-4 px-4 pb-4"}>
          {route === "/" && (
            <Dashboard
              log={log}
              setLog={setLog}
              totals={{ totalCalories, totalProtein, totalSugar }}
              go={navigate}
              openSettings={setSettingsFocus}
            />
          )}

          {route === "/meals" && <Meals log={log} setLog={setLog} />}
          {route === "/snaps" && <Snaps log={log} setLog={setLog} pendingSnap={pendingSnap} setPendingSnap={setPendingSnap} />}
          {route === "/entertainment" && (
            <Entertainment log={log} setLog={setLog} />
          )}
          {route === "/health" && <Health log={log} />}
        </main>

        <BottomNav route={route} setRoute={navigate} />

        {settingsFocus && <Settings user={user} focus={settingsFocus} onClose={() => setSettingsFocus(null)} onLogout={onLogout} />}
      </div>
    </div>
  );
}

function BottomNav({ route, setRoute }) {
  const items = [
    { label: "Home", path: "/", icon: LayoutDashboard },
    { label: "Meals", path: "/meals", icon: Utensils },
    { label: "Snaps", path: "/snaps", icon: Camera },
    { label: "Fun", path: "/entertainment", icon: Sparkles },
    { label: "Health", path: "/health", icon: HeartPulse },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-2xl grid grid-cols-5 rounded-3xl border border-white/70 bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/80 backdrop-blur-xl shadow-lg">
        {items.map(({ label, path, icon: Icon }) => {
          const active = route === path;
          return (
            <button
              key={path}
              onClick={() => setRoute(path)}
              aria-current={active ? "page" : undefined}
              className={classNames(
                "flex flex-col items-center gap-1 py-3 text-[11px] font-semibold transition",
                active ? "text-[hsl(24_80%_58%)]" : "text-zinc-400"
              )}
            >
              <span
                className={classNames(
                  "rounded-2xl p-2 transition",
                  active ? "bg-[hsl(24_80%_58%)]/10" : ""
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
