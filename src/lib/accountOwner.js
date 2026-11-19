// Device dataset ownership is independent of the editable/restorable profile.
// Legacy populated datasets are NEVER silently assigned to a signed-in account.
import { readLocalJSON, writeLocalJSON } from './storage';
export const RESTORE_OWNER_KEY = 'xlife_restore_owner_hint_v1';
export const DATA_OWNER_KEY = 'xlife_data_owner_v1';
export const ownerEmail = (value) => String(value || '').trim().toLowerCase();
export const readDataOwner = () => readLocalJSON(DATA_OWNER_KEY, null);
export function assertIdentity(user) {
  if (!user?.id) throw new Error('Sign in to Xlife Cloud first.');
  const owner = readDataOwner();
  const restoredOwner = readLocalJSON(RESTORE_OWNER_KEY, null);
  if (restoredOwner?.uid && restoredOwner.uid !== user.id) throw new Error("Account mismatch: restored data belongs to another account. Cloud access blocked.");
  const profile = readLocalJSON('dayflow_user', null);
  if (owner && owner.uid !== user.id) throw new Error('Account mismatch: this device belongs to another cloud account. Local data was not changed.');
  if (profile?.email && ownerEmail(profile.email) !== ownerEmail(user.email)) {
    throw new Error('Account mismatch: sign in with this phone’s existing profile. Local data was not changed.');
  }
  if (owner?.profileId && profile?.id && owner.profileId !== profile.id) throw new Error('Local profile identity changed. Cloud access is blocked.');
  return owner;
}
export function assertDataOwner(user) {
  const owner = assertIdentity(user);
  if (!owner) throw new Error('Cloud access is blocked until you explicitly associate this phone’s existing data in Settings.');
  return owner;
}
export function associateDataOwner(user) {
  assertIdentity(user);
  const profile = readLocalJSON('dayflow_user', null);
  // No profile/email means there is no reliable way to identify legacy data.
  if (!profile?.email || ownerEmail(profile.email) !== ownerEmail(user.email)) throw new Error('Create or sign in to the matching local profile first.');
  if (readDataOwner()) return assertDataOwner(user);
  const owner = { uid: user.id, email: ownerEmail(user.email), profileId: profile.id, associatedAt: new Date().toISOString() };
  if (!writeLocalJSON(DATA_OWNER_KEY, owner)) throw new Error('Could not save the data association. Cloud remains blocked.');
  return owner;
}

let epoch = 0;
const requests = new Set();
export const accountEpoch = () => epoch;
export function invalidateCloudOperations() {
  epoch += 1;
  for (const controller of requests) controller.abort();
  requests.clear();
}
export function assertAccountEpoch(expected) {
  if (epoch !== expected) throw new Error('Cloud session changed. Operation cancelled; local data was kept.');
}
// Used for every database/storage/functions request, including background calls.
// Validate the token's identity against the durable dataset owner BEFORE sending.
// Supabase itself verifies the token; decoding here is an additional client gate.
export async function ownerGuardedFetch(input, init = {}) {
  const path = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url).pathname;
  if (path.startsWith('/auth/v1/')) return fetch(input, init);
  const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
  const token = headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  let claims;
  try { claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { throw new Error('Cloud request has no account identity.'); }
  const user = { id: claims.sub, email: claims.email };
  assertDataOwner(user);
  const expected = epoch;
  const controller = new AbortController();
  requests.add(controller);
  const abort = () => controller.abort();
  init.signal?.addEventListener('abort', abort, { once: true });
  if (init.signal?.aborted) controller.abort();
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    assertAccountEpoch(expected);
    assertDataOwner(user);
    return response;
  } finally {
    requests.delete(controller);
    init.signal?.removeEventListener('abort', abort);
  }
}

// Never trust an offline file to replace local ownership/auth/cache metadata.
export function isCloudIdentityKey(key) {
  return key === DATA_OWNER_KEY || key === RESTORE_OWNER_KEY || key === 'dayflow_active_session' || key.startsWith('xlife_cloud_');
}
export function validateBackupOwner(pkg, storage = localStorage) {
  const parse = (key) => { try { return JSON.parse(storage.getItem(key)); } catch { return null; } };
  const owner = parse(DATA_OWNER_KEY);
  const profile = parse('dayflow_user');
  for (const key of [DATA_OWNER_KEY, RESTORE_OWNER_KEY, 'dayflow_user']) {
    const entry = pkg.keys?.[key];
    if (entry && (entry.encoding !== 'json' || !entry.value || typeof entry.value !== 'object' || Array.isArray(entry.value))) throw new Error('Invalid backup identity metadata. Nothing was restored.');
  }
  if (pkg.keys?.[DATA_OWNER_KEY]?.value?.uid && pkg.keys?.[RESTORE_OWNER_KEY]?.value?.uid && pkg.keys[DATA_OWNER_KEY].value.uid !== pkg.keys[RESTORE_OWNER_KEY].value.uid) throw new Error('Backup identity metadata conflicts. Nothing was restored.');
  const incomingOwner = pkg.keys?.[DATA_OWNER_KEY]?.value || pkg.keys?.[RESTORE_OWNER_KEY]?.value;
  const restoredOwner = parse(RESTORE_OWNER_KEY);
  if (restoredOwner?.uid && incomingOwner?.uid && restoredOwner.uid !== incomingOwner.uid) throw new Error('Backup account conflicts with previously restored data. Nothing was restored.');
  const incomingProfile = pkg.keys?.dayflow_user?.value;
  if (owner && !incomingOwner?.uid && !pkg.keys?.dayflow_user?.value?.email) throw new Error('Backup has no owner identity. Cannot merge into a cloud-associated dataset.');
  if (owner && incomingOwner?.uid && owner.uid !== incomingOwner.uid) throw new Error('Backup belongs to another cloud account. Nothing was restored.');
  if (profile?.email && incomingProfile?.email && ownerEmail(profile.email) !== ownerEmail(incomingProfile.email)) throw new Error('Backup belongs to another local profile. Nothing was restored.');
  if (owner?.profileId && incomingProfile?.id && incomingProfile.id !== owner.profileId) throw new Error('Backup profile identity does not match this device. Nothing was restored.');
}

// Preserve provenance, not authorization. Importing a file can restrict future
// association but NEVER grants cloud access or changes the durable data owner.
export function preserveRestoreOwner(pkg) {
  const incoming = pkg.keys?.[DATA_OWNER_KEY]?.value || pkg.keys?.[RESTORE_OWNER_KEY]?.value;
  if (!incoming?.uid || readDataOwner() || readLocalJSON(RESTORE_OWNER_KEY, null)) return;
  if (!writeLocalJSON(RESTORE_OWNER_KEY, { uid: incoming.uid })) throw new Error('Could not save restore provenance; nothing was restored.');
}
