// Optional Face ID / Touch ID / passcode lock using the maintained
// @capgo/capacitor-native-biometric plugin. Requires NSFaceIDUsageDescription
// in ios/App/App/Info.plist (see docs/SETUP.md). Web builds can't use it.
import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";
import { readLocalJSON, writeLocalJSON } from "./storage";

export const APP_LOCK_KEY = "xlife_app_lock";
export const LOCK_AFTER_MS = 60 * 1000; // re-lock after 1 minute in the background

export function appLockSupported() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("NativeBiometric");
}

export function readAppLock() {
  return { enabled: false, ...readLocalJSON(APP_LOCK_KEY, {}) };
}

export function saveAppLock(next) {
  writeLocalJSON(APP_LOCK_KEY, next);
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
  if (!appLockSupported()) return true;
  try {
    await NativeBiometric.verifyIdentity({
      reason: "Unlock Xlife",
      title: "Unlock Xlife",
      useFallback: true,
    });
    return true;
  } catch {
    return false;
  }
}
