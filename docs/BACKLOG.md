# Xlife engineering backlog and cloud migration plan

_Last updated: 2026-11-13 (pass 3: full backlog)._

This is an honest record of where the code stands. "Working" means it runs on the
device and keeps data in on-device `localStorage`. Nothing syncs to a cloud yet.

## 1. Current feature status

| Area | Status | Notes |
|---|---|---|
| Onboarding, create account, sign in | Working | **Local mode:** the profile is on the phone, there is no password, and sign-in checks the email only. Create Account no longer replaces an existing profile and offers "Sign in instead". **Cloud mode:** Supabase email and password auth. On sign-in, data this phone doesn't have yet is restored additively. |
| Snaps (camera, gallery, Memory / Food / Spending) | Working (needs on-device check) | Photos go to the photo store, not localStorage. Memory streak. |
| Photo storage | Working (needs on-device check) | `@capacitor/filesystem` on iOS and IndexedDB on the web, with a non-destructive migration of old inline photos. |
| Home: dashboard, mood, journal, calendar | Working | Journal prompts, on-this-day notes and memories, real 7-day averages. |
| Wake prompt | Working | Uses the onboarding wake-up time (from 2 h before to 4 h after). "Not yet" snoozes for 1 h, at most twice a day. "Don't ask again today". |
| Day rollover | Working | Also runs if the app stays open past midnight. Waits, with a banner, while a form has unsaved typing. |
| Meal logging, Quick add, My foods | Working | |
| Barcode lookup | Working (web tested with a mocked API; scanning needs on-device check) | Open Food Facts API v2 (ODbL). The values fill the form for review. |
| AI food photo estimate | **Built, off until configured** | Edge Function `estimate-nutrition` (OpenAI vision, server-side key, per-user daily quota). Requires a signed-in Cloud user and `VITE_ENABLE_AI_NUTRITION=true`. |
| Restaurant catalog | Working (local) | Samples are labelled "Sample", seeded once, and never re-seeded or padded back into suggestions. |
| Nearby restaurant search | **Not built** | Needs a keyed place provider. Xlife never invents restaurants. |
| GYM | Working | Multi-set, previous values, rest timer with optional notification, PR badges, summary, CSV export. |
| Sleep (manual + wake confirmation) | Working | HealthKit sync is not built. |
| Cycle tracking | Working (local) | Estimates learned from the user's logged periods, fertile window, late and irregular notes, opt-in reminders, 12-month report (print or PDF on web, share sheet on iOS). |
| Wellness insights | Working (local) | Uses the learned cycle averages. |
| App lock (Face ID / passcode) | Built (needs on-device check) | `@capgo/capacitor-native-biometric`. Re-locks after 1 minute in the background. |
| Reminders (journal / period / rest) | Built (needs on-device check) | `@capacitor/local-notifications`. All are opt-in. |
| Us: Together, question of the day, plans, memories | Working (local) | The question's partner reveal and the partner feed work through Cloud. |
| Us: real pairing and partner feed | **Built, off until configured** | Invite codes are single-use and expire after 7 days. The partner sees only shared categories (RLS). |
| Partner sharing controls | Working | Health, intimacy, journal, sleep, spending and mood are private by default. Mirrored to `couple_shares` when Cloud is on. |
| Demo partner | Labelled demo | Persisted until "End demo". |
| Cloud backup / restore | **Built, off until configured** | Idempotent upserts and photo upload to a private bucket. Restore only adds. Also backs up in the background (at most every 10 min). |
| Entertainment headlines | Static (labelled) | Needs a licensed source. |
| iOS widgets | **Not built** | Needs a WidgetKit extension and an App Group in Xcode. |

## 2. What changed in pass 3 (branch `feat/backlog-pass-2`)

- **Refactor:** `App.jsx` (about 4,000 lines) is split into `features/*`, `components/*` and `lib/*` with no behaviour change. Commit `bd56131`.
- **Bugs:**
  - Create Account no longer overwrites an existing profile.
  - The wake-time preference is now used.
  - The wake prompt no longer returns after its snooze.
  - `dayflow_last_active_at` was written JSON-quoted and never parsed.
  - The midnight reload no longer loses half-typed forms.
  - Photos are out of localStorage.
  - The partner demo is persisted.
  - Sample restaurants are seeded once and stay deletable.
- **Security:** Capacitor iOS was bumped from 8.3.4 to 8.6.2 to fix GHSA-rvm3-566m-v7fv.
- **Features:** all 16 competitor ideas except iOS widgets (see section 4).
- **Backend:**
  - `supabase/migrations` (verified on Postgres 17 with an RLS smoke test).
  - `supabase/functions/estimate-nutrition` (type-checked with Deno).
  - Client code behind flags.

## 2b. Merged from local-latest (~/dayflow, integration branch)
- Xlife app icon, Xcode team/display name/category, xcworkspace + Package.resolved, location usage strings, `@capacitor/geolocation`.
- Full-screen black Snaps with a review step (Save Memory / Mark Food / Track Spending / Retake) and no header on Snaps.
- Gym completion: encouragement, logged exercises, completed time, Start another workout.
- Us: Invite Partner / Copy Code / Share Invite / Enter Partner Code / Disconnect (`xlife_partner_connection`), wired to real invite codes when Xlife Cloud is on.
- Meals: location input + Use My Location → Apple/Google Maps (the local build's made-up nearby restaurants, ratings and distances were not kept).
- Snaps food: the local build's fixed "Grilled chicken rice bowl" AI estimate was replaced by the real AI function (when configured) or manual entry.
- Cloud session restore on launch + Xlife loading screen; safe-area and dark-mode input fixes.

## 3. Backlog (what's left)

### Needs you (credentials / device)
1. Run the on-device checks in `docs/SETUP.md` §6:
   - camera
   - photo migration on an iPhone with existing data
   - Face ID
   - notifications
   - barcode scanning
   - share sheet exports
2. Create the Supabase project, run the migrations, set the env and secrets, and deploy the function (`docs/SETUP.md`).
3. Replace the default Capacitor app icon.

### Next engineering
- Two-way sync with conflict resolution (today: upload is idempotent, restore is additive, and there are no deletes in the cloud).
- Delete orphaned photos (deleting a record doesn't remove its file yet), plus cloud delete propagation.
- Realtime partner updates (Supabase Realtime), and shared plans that both partners can edit.
- iOS WidgetKit extension (partner's latest snap, days together, countdown) using an App Group.
- HealthKit sleep import, a nearby-restaurants provider, and live entertainment data. Each needs a provider or entitlement decision.
- CI: run lint, build, Playwright smoke tests and the RLS test on every PR.

### Done in pass 1 (reliability, needs iPhone verification)
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

### Done in pass 2 (optimization, needs iPhone verification)
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
- [x] (Fixed in pass 3) Create Account overwriting a profile; the unused wake-time preference.

## 4. Competitor comparison and improvement ideas

Researched on 2026-11-12. Effort: S is under a day, M is 2–5 days, L is 1–3 weeks.

| # | Idea | Inspired by | Effort | Status |
|---|---|---|---|---|
| 1 | Done Workout summary + no duplicate saves | Strong, Hevy | S | **Implemented (pass 2)** |
| 2 | Real 7-day nutrition averages | MyFitnessPal | S | **Implemented (pass 2)** |
| 3 | "On this day" memories | Day One, Snapchat Memories | S | **Implemented (pass 2)**, plus on-this-day journal notes (pass 3) |
| 4 | Memory streak | Snapchat, BeReal | S | **Implemented (pass 2)** |
| 5 | Honest, labelled cycle estimates | Apple Health | S | **Implemented (pass 2)** |
| 6 | Multi-set logging, previous values, rest timer, PR badges | Hevy, Strong | M | **Implemented (pass 3)** |
| 7 | Period and fertile-window predictions from your own history + notifications | Apple Health, Clue, Flo | M | **Implemented (pass 3)**. Notifications need on-device check. |
| 8 | AI food photo estimate with correction and confidence | Cal AI, MyFitnessPal Meal Scan | L | **Built, needs credentials** (Edge Function + OpenAI key) |
| 9 | Barcode scan + My foods / recent meals | MyFitnessPal, Lose It | M | **Implemented (pass 3)** with Open Food Facts |
| 10 | iOS home-screen widgets | Locket, Dote, Till | L | **Skipped:** needs a native WidgetKit target and an App Group built and tested in Xcode on a Mac |
| 11 | Daily couple question, revealed after both answer | BeReal, Candle, Daily Us | M | **Implemented (pass 3)**. The local answer works now; the partner reveal needs Cloud (RLS-enforced). |
| 12 | Anniversary / days-together counter + countdowns | Between, Dote | S–M | **Implemented (pass 3)**, local |
| 13 | Journal prompts, reminder, Face ID lock | Day One | M | **Implemented (pass 3)**. Reminder and lock need on-device check. |
| 14 | Cycle report for a doctor (12 months) | Apple Health, Flo | M | **Implemented (pass 3)** as a printable view and an HTML share file (Print → Save as PDF) |
| 15 | Workout CSV export | Hevy, Strong | S–M | **Implemented (pass 3)** (export; import from Strong/Hevy is not built) |
| 16 | Per-category partner sharing, private by default | Flo for Partners, Between | M | **Implemented (pass 3)**: the UI, plus enforcement in the database (RLS) |

## 5. localStorage key inventory (do not rename)

| Key | Shape | Written by |
|---|---|---|
| `dayflow_user` | profile object (no password) | Onboarding |
| `dayflow_active_session` | `"true"`/`"false"` | Onboarding, App |
| `dayflow_user_preferences` | goals, cuisines, relationship mode | Onboarding |
| `dayflow_partner_connection` | invite code (local only), read by the Us card as a pending invite; never deleted | Onboarding |
| `xlife_partner_connection` | partner invite/connection `{ inviteCode, status: invite_created/connected, partnerName, cloud/local, … }`; `{ status: "none" }` after disconnect | Us (from local-latest) |
| `dayflow_log` | **today's** working log | AppShell |
| `dayflow_daily_logs` | `{ [YYYY-MM-DD]: log }` archive (new writer in this pass) | AppShell rollover |
| `dayflow_meal_history` | meal array (no photos for new snap meals) | Meals, Snaps |
| `dayflow_restaurants` | restaurant array | Meals |
| `dayflow_rejected_food_suggestions`, `dayflow_saved_food_suggestions` | arrays | Meals |
| `dayflow_spending` | spending array | Snaps |
| `dayflow_workout_history`, `dayflow_workout_<Type>` | array / last values per type; entries from "Start another workout" carry `session_id` | GYM |
| `dayflow_sleep_history` | array, one per date | Sleep |
| `dayflow_last_active_at`, `dayflow_wake_prompt_snoozed_at` | ISO timestamps | Wake prompt |
| `dayflow_cycle_start`, `dayflow_period_logs`, `dayflow_intimacy_logs` | cycle data | Health |
| `dayflow_fun_plans` | plans array | Fun |
| `xlife_pending_snap` | the photo awaiting review (cleared on save/retake) | Snaps (new) |
| `dayflow_snaps`, `dayflow_memories` | read-only legacy fallbacks | none (read only) |
| `xlife_photo_migration_v1` | ISO time the inline-photo migration last completed | main.jsx (pass 3) |
| `xlife_wake_prompt_state` | `{ date, snoozes, skipped }` | Wake prompt (pass 3) |
| `xlife_sample_restaurants_seeded` | ISO time samples were seeded (never re-seed) | Meals (pass 3) |
| `xlife_partner_demo` | demo partner preview, persisted until ended | Us (pass 3) |
| `xlife_rest_seconds` | rest timer length | GYM (pass 3) |
| `xlife_reminders` | `{ journal: { enabled, time }, period: { enabled }, restTimer: { enabled } }` | Settings, Health, GYM (pass 3) |
| `xlife_app_lock` | `{ enabled }` | Settings (pass 3) |
| `xlife_partner_privacy` | `{ [category]: boolean }` | Settings (pass 3) |
| `xlife_couple` | `{ anniversary, countdowns[] }` | Us → Together (pass 3) |
| `xlife_daily_answers` | `{ [date]: { question, answer } }` | Us → Question of the day (pass 3) |
| `xlife_my_foods` | favourite foods array | Meals → Quick add (pass 3) |
| `xlife_cloud_status`, `xlife_cloud_uploaded_photos` | last backup, uploaded photo refs | Xlife Cloud (pass 3) |
| `sb-*-auth-token` | Supabase session (tokens, never the password) | supabase-js, only when Cloud is configured |

Photos: records now hold `xlife-photo:<id>` references. The image files live in `Directory.Data/photos/<id>.jpg` on iOS and in IndexedDB `xlife/photos` on the web. Old `data:image/...` values are still rendered, and they are migrated at startup. A key is rewritten only after every photo in it has been saved and read back. A key that changes during the migration is skipped and retried on the next launch.

Shapes extended without renaming anything:
- Exercise entries gain `sets[]`. The legacy `weight`/`reps`/`done` fields are kept and mirror set 1.
- Restaurants gain `is_sample`. Legacy sample copies are tagged by name and notes on load.

`xlife_partner_connection` (local-latest) and `dayflow_partner_connection` (onboarding) are both kept and read.
If the local `~/dayflow` copy uses the `xlife_` key, reconcile the two before merging.

## 6. Cloud architecture (implemented, disabled until configured)

- **Tables:**
  - Each data table has the same shape: `id text` (`<user_id>:<local id>`), `user_id`, `date`, `data jsonb`, timestamps.
  - Data tables: `daily_logs`, `meals`, `workouts`, `spending`, `sleep_logs`, `period_logs`, `intimacy_logs`, `restaurants`, `plans`, `memories`, `journal_entries`.
  - Other tables: `profiles`, `couples`, `couple_invites`, `couple_shares`, `couple_answers`, `ai_requests`.
- **RLS:**
  - Owners have full access to their own rows.
  - A partner can only `select` a category the owner shares, via `partner_can_read(owner, category)`.
  - `daily_logs` (mixed categories) is never readable by a partner.
  - A daily answer is revealed only after the viewer has answered.
- **Pairing:** `create_couple_invite()` and `accept_couple_invite(code)` are security-definer functions, so codes are single-use and expire after 7 days. One couple per user. `leave_couple()` unpairs.
- **Storage:** a private `photos` bucket at `<user_id>/<photo id>.jpg`. The owner has full access. A partner can read only if the owner shares memories (signed URLs).
- **Migration rules:**
  - Local data is never deleted.
  - Backup uses idempotent upserts.
  - Photos upload once each (tracked in `xlife_cloud_uploaded_photos`).
  - Restore only adds days and records that are missing locally, and downloads missing photos.
- **AI:**
  - The OpenAI key is a function secret only.
  - JWT is required.
  - Per-user daily limit (`AI_DAILY_LIMIT`, default 30).
  - Strict JSON-schema output, shown as approximate, editable values.
