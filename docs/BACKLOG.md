# Xlife engineering backlog and cloud migration plan

_Last updated: 2026-11-12 (reliability pass 1 + optimization pass 2)._

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
| GYM tracker + Done Workout + history | Working | One weight/reps entry per exercise. There's no multi-set support yet. Done Workout collapses into a summary (exercises, volume) and doesn't save duplicates. |
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

### P0b: optimization pass 2 (done, needs iPhone verification)
- [x] `crypto.randomUUID` fallback (`createId`). The iOS target is 15.0, but randomUUID needs 15.4+, so every save would have thrown on older iOS.
- [x] Today's log writes are debounced (250 ms) and flushed when the app is hidden, closed, or unmounted. Notes no longer re-serialise megabytes of photos on every keystroke. The Home calendar no longer re-parses all history on every keystroke.
- [x] `dayflow_last_active_at` updates whenever the app goes to the background, not only when Home opens. This makes the "Are you awake?" timing more accurate.
- [x] Meals: "Add to Meal" / "Add to meal" now actually log the meal. Before, they only filled in the form, and suggestions were written into history as if they had been eaten. Removing a meal also removes its history copy. Photos aren't stored twice.
- [x] Done Workout: you must tick at least one exercise, same-day saves replace each other, and you get a summary with "Workout Complete 💪" plus Edit.
- [x] Plans: choosing option C when the optional B is empty used to save nothing. Confirming now requires an answer for every question.
- [x] Cycle: "Mark as Period" can be undone. Phases are labelled "(estimate)", with a hint when no cycle start is set. The day difference is now DST-safe.
- [x] Track Spending clears the review after saving. A second tap used to save a duplicate.
- [x] Corrupted `dayflow_restaurants` / `dayflow_fun_plans` JSON no longer crashes Meals or Fun.
- [x] Home "Weekly nutrition" shows real 7-day averages. It used to show today's totals labelled "Avg".
- [x] Manual sleep entry computes the duration from bedtime and wake time.
- [x] Accessibility: aria labels on icon buttons, mood, calendar days, and cycle rows. `aria-current` on the tab bar, `aria-pressed` on toggles. Lazy-loaded image lists.
- [x] Logout and delete restaurant ask for confirmation.
- [ ] Not fixed (needs a product decision): Create Account overwrites an existing local profile, though the data is kept. The wake-time preference from onboarding isn't used yet.

## 3. Competitor comparison and improvement ideas

Researched on 2026-11-12 from public product pages and reviews (Apple Support, Flo App Store listing, Clue Support, Hevy feature pages, Strong/Hevy comparisons, MyFitnessPal / Cal AI coverage, Locket/BeReal/couple-widget roundups). Effort: S ≈ under a day, M ≈ 2–5 days, L ≈ 1–3 weeks.

| # | Idea | Inspired by | Effort | Status |
|---|---|---|---|---|
| 1 | Done Workout summary (exercises done, total volume) + no duplicate saves | Strong, Hevy workout summaries | S | **Implemented (pass 2)** |
| 2 | Real 7-day nutrition averages on Home | MyFitnessPal weekly nutrition | S | **Implemented (pass 2)** |
| 3 | "On this day" memories (1 week / 1 month / 1 year ago) | Day One "On This Day", Snapchat Memories | S | **Implemented (pass 2)** |
| 4 | Memory streak on Snaps | Snapchat streaks, BeReal streaks | S | **Implemented (pass 2)** |
| 5 | Honest cycle estimates (labelled, undoable period marks) | Apple Health Cycle Tracking | S | **Implemented (pass 2)** |
| 6 | Multiple sets per exercise with a "previous" column, an automatic rest timer started by ticking a set, and PR badges | Hevy (5 s–5 min per-exercise timer, previous values, live PRs), Strong | M | Proposed (P1) |
| 7 | Period predictions from *your* logged history (average cycle and period length), a 6-day fertile-window estimate, and prediction notifications. Clearly marked as estimates and not contraception. | Apple Health (predictions from logged history, fertile window = next start − 13 days), Clue, Flo | M | Proposed (P1) |
| 8 | Food photo → AI estimate *with quick correction* (edit portion, "add oil/butter", typed or voice description), confidence label, and review before saving. Server-side only. | Cal AI (photo-first, depth-assisted), MyFitnessPal Meal Scan / Voice Log (fine-tune ingredients) | L | Proposed (P2, needs Supabase Edge Function + OpenAI) |
| 9 | Barcode scan + reusable "My foods" / recent meals for 1-tap re-logging | MyFitnessPal, Lose It | M | Proposed |
| 10 | iOS home-screen widgets: partner's latest snap, days together, countdown to the next plan | Locket (photo widget), Dote, Till, Daily Us | L (native WidgetKit + sync) | Proposed (after real pairing) |
| 11 | Couple daily question / daily photo prompt that both see once both have answered | BeReal "post to see", Candle, Daily Us | M (needs Supabase) | Proposed |
| 12 | Shared calendar with anniversary / "days together" counter and countdowns in Us | Between, Dote | S–M | Proposed (local version S) |
| 13 | Journal upgrades: prompts/templates, daily reminder, Face ID lock for Notes and Health | Day One (prompts, reminders, passcode lock) | M | Proposed |
| 14 | Cycle report PDF export (last 12 months) for a doctor | Apple Health, Flo | M | Proposed |
| 15 | Workout CSV export / import from Strong or Hevy | Hevy, Strong | S–M | Proposed |
| 16 | Partner-safe sharing controls per category (cycle/intimacy/journal private by default) | Flo for Partners, Between privacy | M | Proposed (part of Phase 3) |

Top priorities after cloud auth: #6 and #7 (high daily value, no backend needed), then #8 (needs the AI backend), then #10, #11, and #16 (need real pairing).

## 4. localStorage key inventory (do not rename)

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

## 5. Cloud migration plan (Supabase)

Principles: local data is the source of truth until a successful upload is confirmed.
Never delete local keys as part of migration. Make every upload idempotent.

1. **Phase 1: Auth & profiles.** Supabase email auth. A `profiles(id = auth.uid(), name, birthday, preferences jsonb)` table. RLS is `id = auth.uid()`. Keys go in `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` only; the anon key is public by design). Replace the local sign-in. On first cloud sign-in, link the existing local profile.
2. **Phase 2: Data sync.** Tables `daily_logs(user_id, date, log jsonb, updated_at)` (unique `user_id, date`), `meals`, `workouts`, `spending`, `sleep`, `period_logs`, `restaurants`, `plans`. Every row gets a client-generated UUID `id`, `updated_at`, and `deleted_at`. Migration: read each local key, then upsert on `id` (or `user_id, date`). On conflict, the higher `updated_at` wins, so newer cloud data is never overwritten. Record progress in a new key, `xlife_migration_state`. Keep local keys as an offline cache.
3. **Phase 3: Couple pairing.** `couples(id, user_a, user_b, status)` and `invites(code, inviter, expires_at, accepted_by)`. A Postgres function accepts an invite atomically. Per-category share settings live in `share_settings(user_id, category, enabled)`. Health, intimacy, and journal entries are private by default. RLS lets a partner read only rows in categories the owner shares. Shared `plans` and `memories` are readable and writable by both members. Realtime channels are scoped per couple.
4. **Phase 4: Photo storage.** A private Supabase Storage bucket at `/{user_id}/{uuid}.jpg`, served through signed URLs. Upload the local data URLs (or filesystem files) and swap the record to a storage path once the upload succeeds.
5. **Phase 5: AI.** Edge Functions call OpenAI with server-held keys. Never use `VITE_` keys for this. Results are labelled as estimates, and the user confirms before saving.
6. **Phase 6: HealthKit.** A native plugin reads sleep analysis only, with explicit permission. It's off by default.
