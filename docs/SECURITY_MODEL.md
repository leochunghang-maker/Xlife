# Cloud authorization and local dataset ownership (pass 4)

**Cloud stays disabled.** This branch does not deploy migrations, functions, or
cloud/AI configuration. Review first. Deployment and verification against a
separate Supabase test project require a later, explicitly approved operation.
These tests are not live-Supabase or native-iPhone certification.

## Upgrade order (manual, not executed against any live project)

1. Keep cloud/AI off and export an offline backup before upgrading an existing device.
2. After review, apply the existing migrations in filename order, then
   `20261119000000_partner_authorization.sql`. Do **not** rerun just the initial
   migration after the upgrade: it recreates the old policies/functions.
3. The additive upgrade drops the broad partner photo policy and member UPDATE
   policy; it does not delete couples, data records, photos, or local keys.
   A trigger forbids membership rewrites even if an old permissive UPDATE policy
   is accidentally restored. Direct authenticated/anon membership/invite DML is
   revoked. Only the consent RPCs create a pair or disconnect it.
4. Old unused short invite codes expire at upgrade. Generate a new invite after
   upgrading (new codes have 128-bit UUID randomness). Accept is single-use,
   expiring, and rejects self-pairing and either already-paired participant.
   Create/accept/disconnect serialize membership transitions with a transaction
   advisory lock, covering cross-column and simultaneous invitation races.
   Acceptance/disconnect invalidate both participants' other outstanding codes.
5. Sharing requires a matching original invitation acceptance (`created_by`,
   `used_by`, and transaction timestamp matching the couple creation). Existing
   swapped/manually-forged pairs without this evidence remain stored but **cannot
   authorize partner reads**. Disconnect and re-pair with fresh mutual consent.
   Valid pairs made by the original RPC retain access. No existing pair is
   silently rewritten or deleted by the migration.
6. Recheck grants/RLS and bucket privacy in a separate test deployment. Test A/B/C
   including the actual Supabase Storage API, not just SQL. Only consider enabling
   cloud in a separately approved rollout after these checks and review.

## Record-scoped private photos

- Uploads stay in the private `photos` bucket under canonical `<uid>/<id>.jpg`.
- Owners keep access to their own objects. A partner needs a valid consenting
  couple, a matching owner record, an **exact** `xlife-photo:<id>` JSON reference,
  and that record category's enabled sharing flag. Generating a URI, matching a
  filename substring, embedding a URL, or putting a reference in a different
  account's record does not grant access.
- Unreferenced photos are denied. Cycle, sleep, journal, intimacy, restaurants,
  and private aggregate-log photo fields cannot authorize photo sharing. A photo
  referenced by multiple categories must pass **every** referencing category;
  private spending cannot be laundered through an additional shared memory.
- Daily logs remain private aggregates. Their snaps/meals slots only authorize
  access through the dedicated shared memories/meals tables, not through the
  daily log itself. Non-snaps/meals references in an aggregate deny partner access.
- Partner photos use authenticated downloads instead of long-lived signed URLs.
  Each new fetch evaluates RLS. Already downloaded bytes/screenshots cannot be
  recalled; any signed URLs minted by an older build may remain valid until
  their original expiry (formerly one hour). Revoke/rotate those separately in a
  future approved deployment if needed. No such live operation was performed.
- Queries currently scan the small personal JSON stores per photo. Large datasets
  may need indexed reference mappings after profiling; no broad directory fallback
  is allowed. Noncanonical legacy reference IDs fail closed, preserving the local
  photo rather than silently rewriting its path.

## One local dataset, one cloud owner

- `xlife_data_owner_v1` records cloud UID + matching local profile identity only
  after an explicit Settings confirmation. A successful sign-in alone does not
  bind any existing data. Legacy/unbound data stays local; backup, restore,
  background jobs, and partner operations are blocked until association.
- Settings explains that **all** local logs, health data and photos must belong
  to the displayed account, recommends offline export first, and requires confirm.
  There is no account-switch/rebind button or destructive reset in this change.
  A legacy profile email is a guard, not proof of historical ownership; the
  explicit whole-dataset confirmation is required even when the emails match.
- Sign-in email mismatch is rejected *before* changing the auth session. A wrong
  UID returned by auth, or a persisted mismatched session, is signed out locally.
  No password is persisted by the app. Supabase's existing persistent sessions
  still work for the matching original owner.
- All Supabase data/storage/function requests have a local ownership gate. JWT
  claims are decoded only to implement this extra client gate; Supabase must
  verify the JWT and enforce RLS. This is not a replacement for server auth.
- Auth transitions increment an epoch and abort in-flight requests. Operations
  also check their original epoch/owner before subsequent payloads or local
  restore/cache/status writes. A completed A request cannot be relabeled B.
  A write already committed as A before cancellation is not rolled back, and a
  multi-table backup is not one transaction. It must never continue under B.
- Returned restore rows must carry the expected `user_id`; a foreign-owner row
  is rejected before that fetch is merged. Add-only restore from earlier tables
  can remain if a later fetch fails; local existing records are not deleted.
- Upload caches are now `xlife_cloud_uploaded_photos:<uid>`. The old unscoped key
  is preserved but never trusted, so a matching owner may re-upload once. No local
  photo data or prior cache key is deleted or renamed.

## Offline restore is not authentication

Offline exports retain ownership metadata for provenance. Restore never imports
`xlife_data_owner_v1`, `dayflow_active_session`, or any `xlife_cloud_*` operational
metadata as authority; it never replaces an existing local profile. Foreign UID
or profile backups are rejected before photos or records are written.

A fresh-device restore preserves `xlife_restore_owner_hint_v1` (a restriction,
not authorization). That hint prevents subsequently associating the recovered
data with a different UID; the original owner still signs in and explicitly
confirms association. Legacy v1 backups without ownership metadata require the
matching local profile and explicit association, not silent account assignment.
Files with no owner identity cannot merge into an associated cloud dataset.

LocalStorage is not a security boundary against an attacker controlling the
phone/browser or executing arbitrary JS. This change prevents accidental
cross-account mixing; it does not provide encrypted multi-user partitions or
malicious-file authenticity/signatures. Keep offline packages private: they
contain health/journal data and photos. A future legitimate email/profile/UID
change needs a reviewed, nondestructive ownership migration, not key deletion.
If older builds already uploaded data under a wrong account or disclosed a photo,
this upgrade cannot infer/retract that historical exposure. Audit it separately;
no automatic deletion or rewrite of historical user data is attempted.

## Automated checks

```sh
npm ci
npm run lint
npm run build
# In a separate terminal:
npm run preview -- --port 4173
npm run test:e2e
# Self-starting fake-config cloud tests + embedded PostgreSQL (requires psql):
npm run test:security
# Or SQL only:
npm run test:sql
```

`test:security` uses a reserved `.invalid` host, synthetic accounts and token
fixtures, an isolated Vite server, and no real project. It checks Settings and
Onboarding mismatch, explicit binding, original-owner use/persistent session,
foreign backup/restore denial, cache separation and cancellation/background
races. `test:sql` creates a disposable PostgreSQL directory outside the checkout,
applies/reapplies migrations, and runs authenticated/anonymous attacks (not
superuser-only policy mocks). Setup/fixtures alone run as the database owner.
Failures are nonzero. No iOS files or signing settings change; native and live
Supabase verification remain manual.
