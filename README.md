# Xlife

Xlife is a mobile-first lifestyle companion for iPhone. It covers daily logs, meals, camera-first photo memories, spending, gym workouts, sleep, cycle tracking, journaling, and a couple space. It's built with React + Vite + Tailwind and packaged for iOS with Capacitor.

> **Status: working app, local-first.** Out of the box, everything is stored on the phone: records in `localStorage`, photos in the app's private files (IndexedDB on the web). **Xlife Cloud** (Supabase accounts, backup, real partner pairing, photo storage) and **AI food-photo estimates** are fully coded but switched off until you configure them. See [`docs/SETUP.md`](docs/SETUP.md). The detailed status and backlog are in [`docs/BACKLOG.md`](docs/BACKLOG.md).

## Features

- **Camera-first Snaps.** Take a photo (native iOS camera) or pick one from the gallery, then:
  - **Save Memory** with a caption. A memory streak is shown.
  - **Mark Food**.
  - **Track Spending**.
- **Home**:
  - Calories, protein, and sugar.
  - Real 7-day nutrition averages.
  - Mood.
  - **Journal** with a daily reflection prompt and your notes from one week, one month, and one year ago ("on this day").
  - Today's snaps and "On this day" memories.
  - Sleep, and an "Are you awake?" prompt that follows your preferred wake-up time.
  - A day calendar for every past day.
- **Meals**:
  - Manual logging.
  - **Quick add**: your most-logged meals, plus starred **My foods**.
  - **Barcode lookup** using Open Food Facts open data. Scan on iPhone, or type the number.
  - A restaurant catalog. The sample entries are labelled and never come back once you delete them.
  - Optional AI photo estimates, when configured.
- **GYM**:
  - Splits with **multiple sets** per exercise.
  - Your **previous** values from the last session.
  - A **rest timer** that starts when you tick a set, with an optional notification.
  - **🏆 PR badges** (best weight or estimated 1RM).
  - A completion summary.
  - **CSV export**.
- **Health**:
  - Cycle logging.
  - **Estimates learned from your own logged periods**: next period, the fertile window, average cycle and period length, and late or irregular notes. These are always labelled as estimates.
  - Opt-in reminders.
  - A **12-month cycle report** you can print or save as a PDF for a doctor.
  - Wellness insights.
- **Us (Fun)**:
  - A **Together** card with days together, the next anniversary, and countdowns.
  - A **question of the day**.
  - Plan builder.
  - Memories.
  - When paired through Xlife Cloud: a real partner feed that shows only the categories your partner chose to share.
- **Settings** (gear icon):
  - Face ID / passcode **app lock**.
  - Daily journal reminder.
  - **What your partner can see**, set per category. Health, intimacy, journal, sleep, spending, and mood are private by default.
  - Xlife Cloud account, backup, restore, and pairing.

## Clearly labelled demo or sample content

- In local-only mode, "Preview with demo partner" is a labelled local demo. It is saved until you end it.
- Entertainment headlines and the built-in date ideas are static samples. "Sample" restaurant fallback ideas are not real businesses.
- In local-only mode, sign-in checks only the profile saved on the phone (no password). Use the Face ID lock to protect the app. With Xlife Cloud configured, sign-in uses real Supabase email and password authentication.

## Not built (documented integrations)

| Integration | Why not yet |
|---|---|
| Nearby restaurant search | Needs a paid or keyed place-data provider (Google Places, Yelp, Foursquare). Xlife doesn't invent restaurants. |
| Live entertainment / news | Needs a licensed data source. |
| Apple HealthKit sleep import | Needs a native HealthKit plugin, entitlement, and an on-device test. |
| iOS home-screen widgets | Needs a native WidgetKit extension and an App Group (Xcode work that can't be verified without a Mac). |

## Architecture

```
src/
  App.jsx                 # auth gate + Face ID lock gate
  main.jsx                # one-time photo migration, then render
  components/             # ui primitives, StoredImage, AppLockGate
  features/               # one file per screen/feature (AppShell, Dashboard, Meals, Snaps,
                          # Gym, Health, CycleInsights, Entertainment, Together, DailyQuestion,
                          # Journal, Settings, CloudSettings, PartnerFeed, MealTools, Onboarding, Sleep)
  lib/
    storage.js            # safe localStorage, local dates, ids, storage-full events
    photoStore.js         # photos in Filesystem (iOS) / IndexedDB (web) + migration
    dailyLog.js dates.js  # day log, rollover, history
    gym.js cycle.js cyclePredict.js journal.js couple.js dailyQuestion.js foodData.js
    notifications.js appLock.js privacy.js exportFile.js dirtyForms.js
    supabase.js cloud.js cloudAuto.js ai.js   # cloud + AI (off unless configured)
supabase/
  migrations/             # Postgres schema + Row Level Security + storage policies
  functions/estimate-nutrition/  # Edge Function (OpenAI key lives only here as a secret)
  tests/                  # RLS smoke test (embedded Postgres, no Docker)
ios/                      # Capacitor iOS project (bundle id com.xlife.app)
docs/SETUP.md docs/BACKLOG.md
```

The original `dayflow_*` storage keys are kept unchanged so data on installed phones survives upgrades. New keys use an `xlife_` prefix (see the key inventory in the backlog).

## Tech stack

React 19 · Vite 8 · Tailwind CSS 3 · Framer Motion · Lucide · Capacitor 8.6 (iOS, Swift Package Manager), with these plugins:

- camera, filesystem, local-notifications, share, barcode-scanner
- `@capgo/capacitor-native-biometric`

Backend (optional): Supabase JS, Supabase Edge Functions (Deno).

## Getting started

```bash
npm install
npm run dev        # web dev server (camera falls back to the browser file picker)
npm run lint
npm run build
```

iOS: `npm run build && npx cap sync ios && npx cap open ios`, then Run in Xcode. Full steps, including Cloud and AI setup, are in **[docs/SETUP.md](docs/SETUP.md)**.

## Privacy & security

- Personal photos, health data, and `.env` files are never committed (`.env*` is git-ignored).
- Only the Supabase **anon** key may go in `VITE_` variables. Row Level Security protects every table. The service-role key and the OpenAI key exist only as Supabase Edge Function secrets.
- Passwords are never stored by Xlife. With Cloud enabled, Supabase Auth handles them.
- Partner sharing is opt-in per category and enforced by the database, not just the UI.
