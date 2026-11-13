import { useCallback, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "./ui.jsx";
import { appLockSupported, readAppLock, unlockWithBiometrics, LOCK_AFTER_MS } from "../lib/appLock";
import { nowMs } from "../lib/utils";

// Covers the app until Face ID / passcode succeeds, on launch and when the app
// returns after more than a minute in the background. No-op unless enabled.
export function AppLockGate({ children }) {
  const enabled = appLockSupported() && readAppLock().enabled;
  const [locked, setLocked] = useState(enabled);
  const hiddenAt = useRef(null);
  const busy = useRef(false);

  const tryUnlock = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const ok = await unlockWithBiometrics();
    busy.current = false;
    if (ok) setLocked(false);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    // Ask for Face ID right away on launch.
    const first = window.setTimeout(() => tryUnlock(), 0);
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = nowMs();
        return;
      }
      if (hiddenAt.current && nowMs() - hiddenAt.current > LOCK_AFTER_MS && readAppLock().enabled) {
        setLocked(true);
        tryUnlock();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, tryUnlock]);

  if (!locked) return children;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[hsl(30_30%_98%)] p-6 text-center dark:bg-zinc-950 dark:text-zinc-50">
      <Lock className="h-10 w-10 text-[hsl(24_80%_58%)]" />
      <p className="text-2xl font-black">Xlife is locked</p>
      <Button onClick={tryUnlock} className="rounded-2xl bg-[hsl(24_80%_58%)] px-6 py-4 text-white">Unlock</Button>
    </div>
  );
}
