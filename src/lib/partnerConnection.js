// Partner connection state (from local-latest), key `xlife_partner_connection`:
// { id, ownerUserId, inviteCode, partnerName, partnerEmail,
//   status: "invite_created" | "connected", createdAt, connectedAt,
//   cloud?: true  (real pairing through Supabase couples / invite codes),
//   local?: true  (paired on this phone only; nothing is shared) }
import { readLocalJSON, writeLocalJSON } from "./storage";

export const PARTNER_CONNECTION_KEY = "xlife_partner_connection";

// Onboarding's partner step writes the original `dayflow_partner_connection`
// ({ inviteCode, connected:false }). It is read (never deleted) as a pending
// local invite when there is no xlife_partner_connection yet.
const LEGACY_KEY = "dayflow_partner_connection";

export function readPartnerConnection() {
  const value = readLocalJSON(PARTNER_CONNECTION_KEY, null);
  if (value && typeof value === "object") return value.status === "none" ? null : value;
  const legacy = readLocalJSON(LEGACY_KEY, null);
  if (legacy && typeof legacy === "object" && legacy.inviteCode) {
    return {
      id: legacy.id || `legacy-${legacy.inviteCode}`,
      ownerUserId: "local-user",
      inviteCode: legacy.inviteCode,
      partnerName: legacy.partnerName || null,
      partnerEmail: null,
      status: legacy.connected ? "connected" : "invite_created",
      createdAt: legacy.createdAt || null,
      connectedAt: null,
      local: true,
      fromOnboarding: true,
    };
  }
  return null;
}

export function savePartnerConnection(connection) {
  // Disconnecting writes { status: "none" } so an onboarding invite stored in
  // the legacy key doesn't reappear (the legacy key itself is left untouched).
  writeLocalJSON(PARTNER_CONNECTION_KEY, connection || { status: "none", clearedAt: new Date().toISOString() });
}

// XLIFE-XXXX for local invites (cloud invites use the server-generated code).
export function generateLocalInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `XLIFE-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}
