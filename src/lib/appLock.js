// Optional Face ID / Touch ID / passcode lock using the maintained
// @capgo/capacitor-native-biometric plugin. Requires NSFaceIDUsageDescription
// in ios/App/App/Info.plist (see docs/SETUP.md). Web builds can't use it.
import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";
import { readLocalJSON, writeLocalJSON } from "./storage";

export const APP_LOCK_KEY = "xlife_app_lock";
export { LOCK_AFTER_MS } from './lockController';
const APP_LOCK_CHANGED = 'xlife:app-lock-changed';
let prompting = false;
export const biometricPromptActive = () => prompting;
// A configured native lock must fail CLOSED if its biometric plugin becomes
// unavailable. Web cannot provide native biometrics and never claims to lock.
export const appLockEnabledSnapshot = () => Capacitor.isNativePlatform() && Boolean(readAppLock().enabled);
export function subscribeAppLock(callback) {
  const changed = event => callback({ verified: Boolean(event.detail?.verified) });
  const stored = event => { if (event.key === APP_LOCK_KEY || event.key === null) callback({ verified: false }); };
  window.addEventListener(APP_LOCK_CHANGED, changed);
  window.addEventListener('storage', stored);
  return () => { window.removeEventListener(APP_LOCK_CHANGED, changed); window.removeEventListener('storage', stored); };
}

export function appLockSupported() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("NativeBiometric");
}

export function readAppLock() {
  return { enabled: false, ...readLocalJSON(APP_LOCK_KEY, {}) };
}

export function saveAppLock(next, { verified = false } = {}) {
  const ok = writeLocalJSON(APP_LOCK_KEY, next);
  if (ok) window.dispatchEvent(new CustomEvent(APP_LOCK_CHANGED, { detail: { verified } }));
  return ok;
}

export async function biometricAvailability() {
  if (!appLockSupported()) return { available: false };
  try {
    const result = await NativeBiometric.isAvailable({ useFallback: true });
    return { available: Boolean(result.isAvailable), type: result.biometryType };
  } catch {
    return { available: false };
  }
}

export async function unlockWithBiometrics() {
  if (!appLockSupported() || prompting) return false;
  prompting = true;
  try {
    await NativeBiometric.verifyIdentity({
      reason: "Unlock Xlife",
      title: "Unlock Xlife",
      useFallback: true,
    });
    return true;
  } catch {
    return false;
  } finally {
    prompting = false;
  }
}
