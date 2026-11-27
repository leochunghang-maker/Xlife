import { useEffect, useState, useSyncExternalStore } from "react";
import { App as NativeApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Lock } from "lucide-react";
import { Button } from "./ui.jsx";
import { appLockEnabledSnapshot, subscribeAppLock, unlockWithBiometrics, biometricPromptActive } from "../lib/appLock";
import { createLockController, attachLockLifecycle } from "../lib/lockController";

// Best-effort WebView shield, NOT a promise of native screenshot/snapshot security.
export function AppLockGate({ children }) {
  const [controller] = useState(() => createLockController({ enabled: appLockEnabledSnapshot(), authenticate: unlockWithBiometrics }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => subscribeAppLock(options => controller.setEnabled(appLockEnabledSnapshot(), options)), [controller]);
  useEffect(() => {
    if (!state.enabled) return undefined;
    return attachLockLifecycle(controller, {
      doc: document,
      isPrompting: biometricPromptActive,
      addNativeListener: Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('App')
        ? (event, callback) => NativeApp.addListener(event, callback) : null,
    });
  }, [controller, state.enabled]);
  useEffect(() => {
    // Launch prompt only. Same-session enabling already verified in Settings.
    if (!appLockEnabledSnapshot()) return undefined;
    const timer = window.setTimeout(() => controller.unlock(), 0);
    return () => window.clearTimeout(timer);
  }, [controller]);
  const covered = state.enabled && (state.locked || state.shielded);
  return <>
    <div inert={covered} aria-hidden={covered || undefined} style={covered ? { visibility: "hidden" } : undefined}>{children}</div>
    {covered && <div data-testid="app-lock-shield" className="fixed inset-0 z-[1000] flex min-h-screen flex-col items-center justify-center gap-4 bg-[hsl(30_30%_98%)] p-6 text-center dark:bg-zinc-950 dark:text-zinc-50">
      <Lock className="h-10 w-10 text-[hsl(24_80%_58%)]" />
      <p className="text-2xl font-black">{state.locked ? "Xlife is locked" : "Xlife is private"}</p>
      {state.locked && !state.shielded && <Button onClick={() => controller.unlock()} disabled={state.busy} className="rounded-2xl bg-[hsl(24_80%_58%)] px-6 py-4 text-white">{state.busy ? "Authenticating…" : "Unlock"}</Button>}
      {state.error && <p role="status">{state.error}</p>}
    </div>}
  </>;
}
