// What a paired partner may see. Health, intimate and journal data are
// private by default; nothing is shared until real pairing exists and the
// user turns a category on. Stored per device in xlife_partner_privacy and
// mirrored to the cloud couple_shares table when cloud sync is enabled.
import { readLocalJSON, writeLocalJSON } from "./storage";

export const PRIVACY_KEY = "xlife_partner_privacy";
export const PRIVACY_CATEGORIES = [
  { id: "memories", label: "Memories (snaps)", defaultShared: true },
  { id: "plans", label: "Plans", defaultShared: true },
  { id: "meals", label: "Meals", defaultShared: false },
  { id: "workouts", label: "Workouts", defaultShared: false },
  { id: "mood", label: "Mood", defaultShared: false },
  { id: "sleep", label: "Sleep", defaultShared: false, sensitive: true },
  { id: "spending", label: "Spending", defaultShared: false, sensitive: true },
  { id: "cycle", label: "Cycle & period", defaultShared: false, sensitive: true },
  { id: "intimacy", label: "Intimacy", defaultShared: false, sensitive: true },
  { id: "journal", label: "Journal notes", defaultShared: false, sensitive: true },
];

export function readPrivacy() {
  const saved = readLocalJSON(PRIVACY_KEY, {});
  return Object.fromEntries(PRIVACY_CATEGORIES.map((c) => [c.id, typeof saved?.[c.id] === "boolean" ? saved[c.id] : c.defaultShared]));
}

export function savePrivacy(next) {
  writeLocalJSON(PRIVACY_KEY, next);
}

export function isShared(category, privacy = readPrivacy()) {
  return Boolean(privacy[category]);
}
