# Xlife

Xlife is a mobile-first lifestyle companion for iPhone. It covers daily logs, meals, camera-first photo memories, spending, gym workouts, sleep, cycle tracking, and a couple space. It's built with React + Vite + Tailwind and packaged for iOS with Capacitor.

> **Status: working prototype, local-only.** All data is stored on the device in `localStorage`. There's no cloud backend, AI model, real partner sync, or Apple Health integration yet. Those are planned, and this README marks each one as planned. See [`docs/BACKLOG.md`](docs/BACKLOG.md) for the detailed status, prioritized backlog, and cloud migration plan.

## What works today

- **Camera-first Snaps.** The app opens on Snaps after sign-in. You take a photo with the native iOS camera (`@capacitor/camera`) or pick one from the gallery. You then choose one of three options:
  - **Save Memory**: caption it. It shows on Home and in Fun → Us → Memories.
  - **Mark Food**: meal type, food, calories, protein, sugar, cost, a 5-star rating, and notes, all entered by you.
  - **Track Spending**: item, amount, category, merchant, and notes.
- **Home dashboard**: calories, protein, and sugar progress, mood, daily notes, today's snaps, sleep, and an "Are you awake?" wake-up confirmation.
- **Day calendar**: pick any date to see that day's meals, sleep, mood and notes, workout, snaps, cycle, and spending. Each day's log is archived under its own date.
- **Meals**: manual meal logging and a personal restaurant catalog (add, search, filter by cuisine, save, reject). "Smart pick" suggestions are ranked on the phone from your own history.
- **GYM**: Chest, Back, Shoulder/Arm, Chest/Back, Leg, and Rest splits. You log weight and reps per exercise, then Done Workout saves history and remembers your last values.
- **Health**: cycle logging (period, symptoms, spotting, factors, notes) with a calendar, plus wellness insights computed from your own logs.
- **Us (Fun)**: a plan builder with multiple-choice blocks and a final plan, plus a memories feed (on one phone).

## Prototype / mock (clearly labelled in the app)

- Account sign-in is local only. It isn't real authentication, and no password is stored.
- Partner pairing, the partner updates feed, and "Send to partner" are a local demo. Nothing leaves the phone.
- Entertainment headlines and date ideas are static samples.
- Restaurant fallback ideas are samples, not real businesses.

## Planned integrations

| Integration | Purpose |
|---|---|
| Supabase Auth + Postgres + RLS | Real accounts, cloud sync, secure couple pairing |
| Supabase Storage | Cloud photo storage |
| OpenAI (via server-side Edge Functions only) | Food photo recognition, nutrition estimates, recommendations, date planning |
| Places provider (Google Places / Yelp) | Real nearby restaurants |
| Apple HealthKit | Optional sleep import |

## Architecture

```
src/
  App.jsx          # app shell, 5 tabs (Home, Meals, Snaps, Fun, Health), feature components
  lib/storage.js   # safe localStorage read/write, local-date helpers, storage-full events
  lib/photos.js    # native camera/gallery capture + JPEG compression to persistent data URLs
  lib/supabase.js  # Supabase client + future sync helpers (not wired up yet)
ios/               # Capacitor iOS project (bundle id com.xlife.app, display name Xlife)
docs/BACKLOG.md    # status, backlog, storage key inventory, cloud migration plan
```

State lives in `AppShell` (today's log) and per-feature components, and is persisted to `localStorage`. The existing `dayflow_*` storage keys are deliberately kept from the app's original name ("Dayflow") so data on installed phones survives upgrades. See the key inventory in the backlog.

## Tech stack

React 19 · Vite · Tailwind CSS 3 · Framer Motion · Lucide icons · Capacitor 8 (iOS, Swift Package Manager) · `@capacitor/camera` · Supabase JS (scaffold)

## Getting started

```bash
npm install
npm run dev        # web dev server (the camera falls back to the browser file picker)
npm run lint
npm run build
```

### iOS

```bash
npm run build
npx cap sync ios   # copies the web build and links native plugins (Camera)
npx cap open ios   # then select your team/device in Xcode and Run
```

Requirements: macOS with Xcode, plus an Apple developer account for installing on a physical iPhone.

### Environment

Copy `.env.example` to `.env` when Supabase is set up. Only the public anon key belongs in `VITE_` variables. Never put service-role or OpenAI keys in client code. `.env` files are git-ignored.

## Roadmap

1. Photo storage in the device filesystem (removes the localStorage size limit)
2. Supabase auth, profiles, and safe migration of local data
3. Real two-phone couple pairing with per-category sharing controls
4. Server-side AI food recognition (results shown as estimates)
5. Nearby restaurant search, then HealthKit sleep, then TestFlight

## Privacy

Personal photos, health data, and environment files must never be committed. Cycle, intimacy, and journal data are intended to stay private by default when sharing is built.
