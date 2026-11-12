# Xlife engineering backlog and cloud migration plan

_Last updated: 2026-11-12 (reliability pass 1)._

This is an honest record of where the code stands. "Working" means it runs on the
device and keeps data in on-device `localStorage`. Nothing syncs to a cloud yet.

## 1. Current feature status

| Area | Status | Notes |
|---|---|---|
| Onboarding, create account, sign in | **Prototype** | The profile is stored on the phone (`dayflow_user`). Passwords are **not** stored, and sign-in only checks the email. This is not real authentication. |
| Bottom navigation (5 tabs), camera-first start | Working | Opens on Snaps after onboarding or sign-in. |
| Snaps: take a photo or pick one from the gallery | Working (needs on-device check) | Uses `@capacitor/camera` on iOS and a file input on the web. Uses the native camera UI, not a live in-app viewfinder. |
| Snaps: Save Memory / Mark Food / Track Spending | Working | Photos are saved as compressed JPEG data URLs. |
| Home dashboard, mood, notes, calorie progress | Working | Data rolls over per day and is archived by date. |
| Day calendar / history | Working | Reads `dayflow_daily_logs`, the sleep, workout, meal, and spending history, and the period logs. |
| Meal logging (manual) | Working | |
| AI food recognition from a photo | **Not built** | There's no vision API. The Mark Food form asks you to type the values in. |
| Restaurant catalog (add, search, save, reject) | Working (local only) | Seeded with 2 sample restaurants. |
| "Smart pick" recommendations | Prototype | Ranked on the phone from your own meals and catalog. It isn't AI and doesn't use live data. Sample fallback ideas are labelled. |
| Nearby / current-location restaurant search | **Not built** | Needs a place-data provider (Google Places, Yelp, Foursquare). |
| GYM tracker + Done Workout + history | Working | One weight/reps entry per exercise. There's no multi-set support yet. |
| Sleep: manual entry and "Are you awake?" | Working | |
| Apple Health / HealthKit sleep sync | **Not built** | There's no native plugin or entitlement. The button now says "soon" and no longer fakes data. |
| Cycle tracking + calendar | Working (local only) | Phase is estimated with a fixed 28-day model. |
| Wellness insights | Working (local only) | Uses only real logs now. Earlier builds mixed in generated sample logs. |
| Us: partner pairing / invite codes | **Mock** | The code is saved on this phone only. "Preview with demo partner" is a local demo. |
| Us: partner updates feed | **Mock** | Sample cards built from your own log. They're labelled as a demo. |
| Us: plan builder, send, choose, final plan | Prototype | Works on one phone. "Send to partner" doesn't send anything. |
| Us: memories feed | Working (local only) | Shows all saved memories, including earlier days. |
| Entertainment | **Static** | Sample headlines, labelled as not live. |
| Export 30-day PDF | Not built | The button is disabled and marked "coming soon". |
| Supabase | Scaffold only | `src/lib/supabase.js` has helper stubs and isn't called anywhere. |

## 2. Prioritized backlog

### P0: reliability (this pass, needs iPhone verification)
- [x] Snaps first-capture review screen. The pending photo state moved into `AppShell` and is mirrored to `xlife_pending_snap`. Captures are guarded against re-entry, and cancel and permission errors are handled.
- [x] Real camera via `@capacitor/camera` + iOS privacy strings in `Info.plist`.
- [x] Photo persistence: compressed data URLs only, never `blob:` URLs or temporary native file paths.
- [x] Daily log rollover: the old single `dayflow_log` is archived into `dayflow_daily_logs[date]`. The app reloads on resume when the date has changed.
- [x] Record dates use the local calendar day instead of the UTC date, which was "yesterday" before 08:00 in Hong Kong.
- [x] localStorage quota: writes are guarded, and a "storage full" banner replaces the crash or silent data loss.
- [x] Dark-mode input contrast (`.field`), `color-scheme`, no iOS focus zoom.
- [x] Safe areas (`viewport-fit=cover`, `env(safe-area-inset-*)`), and the camera screen fits without scrolling.
- [x] User-visible Dayflow branding changed to Xlife. Storage keys are deliberately unchanged.
- [x] Removed fabricated data: demo meals and snaps in new logs, fake Apple Health sync, fake food estimate, mock wellness stats.

### P1: next
1. Move photos out of localStorage into `@capacitor/filesystem`, keeping a path in the record. This removes the ~5 MB quota ceiling. Migrate existing data URLs lazily.
2. Supabase Phase 1: Auth (email), `profiles`, persistent session, logout, RLS.
3. Real partner pairing (Phase 3 below), which replaces the demo partner.
4. Split `App.jsx` (~3,700 lines) into `features/{snaps,meals,home,fun,health}`, with no behaviour change.
5. Add a test harness (Vitest + Playwright) to CI with the smoke flows used for this pass.

### P2
- Server-side AI (Supabase Edge Function → OpenAI vision) for food photos, showing results as estimates.
- Place-data provider for nearby restaurants, plus location permission (`NSLocationWhenInUseUsageDescription`).
- HealthKit plugin (read-only sleep) as an option.
- Live camera viewfinder (e.g. `@capacitor-community/camera-preview`) if the native picker isn't good enough.
- Multi-set workout logging, PDF export, live entertainment data.
- Real app icon. The committed `AppIcon` is still the default Capacitor icon.

## 3. localStorage key inventory (do not rename)

| Key | Shape | Written by |
|---|---|---|
| `dayflow_user` | profile object (no password) | Onboarding |
| `dayflow_active_session` | `"true"`/`"false"` | Onboarding, App |
| `dayflow_user_preferences` | goals, cuisines, relationship mode | Onboarding |
| `dayflow_partner_connection` | invite code (local only) | Onboarding |
| `dayflow_log` | **today's** working log | AppShell |
| `dayflow_daily_logs` | `{ [YYYY-MM-DD]: log }` archive (new writer in this pass) | AppShell rollover |
| `dayflow_meal_history` | meal array (no photos for new snap meals) | Meals, Snaps |
| `dayflow_restaurants` | restaurant array | Meals |
| `dayflow_rejected_food_suggestions`, `dayflow_saved_food_suggestions` | arrays | Meals |
| `dayflow_spending` | spending array | Snaps |
| `dayflow_workout_history`, `dayflow_workout_<Type>` | array / last values per type | GYM |
| `dayflow_sleep_history` | array, one per date | Sleep |
| `dayflow_last_active_at`, `dayflow_wake_prompt_snoozed_at` | ISO timestamps | Wake prompt |
| `dayflow_cycle_start`, `dayflow_period_logs`, `dayflow_intimacy_logs` | cycle data | Health |
| `dayflow_fun_plans` | plans array | Fun |
| `xlife_pending_snap` | the photo awaiting review (cleared on save/retake) | Snaps (new) |
| `dayflow_snaps`, `dayflow_memories` | read-only legacy fallbacks | none (read only) |

The handover mentions `xlife_partner_connection`. This repository uses `dayflow_partner_connection`.
If the local `~/dayflow` copy uses the `xlife_` key, reconcile the two before merging.

## 4. Cloud migration plan (Supabase)

Principles: local data is the source of truth until a successful upload is confirmed.
Never delete local keys as part of migration. Make every upload idempotent.

1. **Phase 1: Auth & profiles.** Supabase email auth. A `profiles(id = auth.uid(), name, birthday, preferences jsonb)` table. RLS is `id = auth.uid()`. Keys go in `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` only; the anon key is public by design). Replace the local sign-in. On first cloud sign-in, link the existing local profile.
2. **Phase 2: Data sync.** Tables `daily_logs(user_id, date, log jsonb, updated_at)` (unique `user_id, date`), `meals`, `workouts`, `spending`, `sleep`, `period_logs`, `restaurants`, `plans`. Every row gets a client-generated UUID `id`, `updated_at`, and `deleted_at`. Migration: read each local key, then upsert on `id` (or `user_id, date`). On conflict, the higher `updated_at` wins, so newer cloud data is never overwritten. Record progress in a new key, `xlife_migration_state`. Keep local keys as an offline cache.
3. **Phase 3: Couple pairing.** `couples(id, user_a, user_b, status)` and `invites(code, inviter, expires_at, accepted_by)`. A Postgres function accepts an invite atomically. Per-category share settings live in `share_settings(user_id, category, enabled)`. Health, intimacy, and journal entries are private by default. RLS lets a partner read only rows in categories the owner shares. Shared `plans` and `memories` are readable and writable by both members. Realtime channels are scoped per couple.
4. **Phase 4: Photo storage.** A private Supabase Storage bucket at `/{user_id}/{uuid}.jpg`, served through signed URLs. Upload the local data URLs (or filesystem files) and swap the record to a storage path once the upload succeeds.
5. **Phase 5: AI.** Edge Functions call OpenAI with server-held keys. Never use `VITE_` keys for this. Results are labelled as estimates, and the user confirms before saving.
6. **Phase 6: HealthKit.** A native plugin reads sleep analysis only, with explicit permission. It's off by default.
