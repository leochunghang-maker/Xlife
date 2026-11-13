# Xlife setup guide

Xlife works fully offline in **local-only mode** with no setup. This guide covers:

1. Running the app on an iPhone.
2. *(Optional)* Turning on **Xlife Cloud** (Supabase accounts, backup, real partner pairing, photo storage).
3. *(Optional)* Turning on **AI food-photo estimates**.

> Never commit `.env`, keys, health data or personal photos. Only the Supabase **anon** key may go in `VITE_` variables. The **service-role** key and the **OpenAI** key must exist only as Supabase secrets.

---

## 1. Run on iPhone (local-only)

Requirements: macOS, Xcode 16+, Node 20+, and an Apple ID (a paid developer account is needed for TestFlight).

```bash
npm install
npm run build
npx cap sync ios     # copies dist/ and links the native plugins listed below
npx cap open ios
```

In Xcode, open the **App** target:

1. **Signing & Capabilities:** the project already has `DEVELOPMENT_TEAM = 2GTZ7KDKLY` and display name **Xlife** (from your local work); change the Team if you sign with another account, and keep the bundle id `com.xlife.app` (or change it to your own).
2. **No extra capabilities are required.** Local notifications don't need the Push Notifications capability, and Face ID doesn't need an entitlement.
3. `ios/App/App/Info.plist` already contains the privacy strings:
   - `NSCameraUsageDescription`: camera and barcode scanning.
   - `NSPhotoLibraryUsageDescription` / `NSPhotoLibraryAddUsageDescription`: gallery.
   - `NSLocationWhenInUseUsageDescription` / `NSLocationAlwaysAndWhenInUseUsageDescription`: "Use My Location" in Meals → Find nearby restaurants (only when tapped).
   - `NSFaceIDUsageDescription`: App Lock.
4. Choose your iPhone, then press **Run**.

Native plugins (Swift Package Manager, written by `cap sync`):

- `@capacitor/camera`
- `@capacitor/filesystem` (photo storage)
- `@capacitor/local-notifications` (reminders)
- `@capacitor/share` (CSV and report export)
- `@capacitor/barcode-scanner`
- `@capgo/capacitor-native-biometric` (Face ID lock)

Permissions are requested only when needed:

- **Camera / Photos:** the first time you capture or pick a photo.
- **Notifications:** the first time you turn on a reminder:
  - Settings → Daily journal reminder.
  - Health → Remind me before my period.
  - Gym → Notify me when rest is over.
- **Face ID:** when you turn on Settings → Lock with Face ID. The app checks Face ID once before enabling it.

If you denied a permission, re-enable it in iPhone **Settings → Xlife**.

**After every code change:** `npm run build && npx cap sync ios`, then Run again.

---

## 2. Xlife Cloud (Supabase), optional

### 2.1 Create the project
1. Sign in at <https://supabase.com>, then **New project**. Pick a region near you (e.g. Singapore) and save the database password somewhere safe. It is not needed by the app.
2. **Project Settings → API**: copy the **Project URL** and the **anon / publishable** key.
3. **Authentication → Providers → Email**: keep it enabled.
   - For quick testing you may turn off **Confirm email**.
   - If you keep confirmation on, users tap the link in the email and then sign in inside the app.
4. **Authentication → URL Configuration**: set the Site URL to anything you control (e.g. your website). The app doesn't use magic links.

### 2.2 Run the database migrations
Using the Supabase CLI (recommended):

```bash
npm i -g supabase          # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <your-project-ref>   # from the project URL
supabase db push           # applies supabase/migrations/*.sql in order
```

Without the CLI, open **SQL Editor** and run these files in order:
1. `supabase/migrations/20261113000000_xlife_init.sql`
2. `supabase/migrations/20261113000100_couple_daily_question.sql`

The migrations create:

- Tables, each with Row Level Security.
- The pairing functions.
- A private `photos` storage bucket with its policies.

They are safe to re-run.

*(Optional)* Local RLS smoke test without Docker (requires `psql` on PATH):

```bash
npm i --no-save embedded-postgres && node supabase/tests/run-embedded.mjs
```

### 2.3 Point the app at your project
```bash
cp .env.example .env
# edit .env:
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon/publishable key>
VITE_ENABLE_CLOUD=true
```
Then rebuild: `npm run build && npx cap sync ios`.

### 2.4 Use it
- **New users:** onboarding **Create Account** creates a Supabase account.
- **Existing local users:**
  1. Open **Settings → Xlife Cloud**, then **Create account** or **Sign in**.
  2. Tap **Back up now**. Local data is uploaded and is never deleted from the phone.
- **New phone:** sign in during onboarding. Data that isn't on the phone yet is restored, including photos.
- **Pairing:**
  1. Partner A: **Settings → Xlife Cloud → Create invite code**.
  2. Partner B: enter the code, then **Join**.
  3. Each partner picks what to share under **What your partner can see**.
- Turn Cloud off at any time with `VITE_ENABLE_CLOUD=false` (the app falls back to local mode).

---

## 3. AI food-photo estimates, optional (requires section 2)

1. Create an OpenAI API key at <https://platform.openai.com> and set a monthly usage limit there.
2. Store the key **only** as a function secret:
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-...
   # optional:
   supabase secrets set OPENAI_MODEL=gpt-4o-mini AI_DAILY_LIMIT=30
   ```
3. Deploy the function (JWT verification stays on, per `supabase/config.toml`):
   ```bash
   supabase functions deploy estimate-nutrition
   ```
4. Enable the UI in `.env`: `VITE_ENABLE_AI_NUTRITION=true`, then rebuild and `cap sync`.
5. In the app: **Meals → Food photo**:
   1. Attach a photo.
   2. Optionally describe it.
   3. Tap **Estimate with AI**.
   4. Edit the approximate values, then **Use these values** and **Add**.

   Only signed-in users can call the function, and each user has a daily quota.

---

## 4. Barcode lookup

No setup is needed. The app uses the free [Open Food Facts](https://world.openfoodfacts.org) API (data under ODbL). Scanning uses the camera permission. On the web you can type the barcode number.

## 5. Not included (would need a provider or native work)
- In-app nearby restaurant results: needs a Google Places / Yelp / Foursquare key behind a server function. Today Meals → Find nearby restaurants opens Apple Maps / Google Maps with your cuisine and location instead of showing made-up places.
- Live entertainment: a licensed API.
- HealthKit sleep: a HealthKit plugin plus the entitlement.
- Home-screen widgets: a WidgetKit extension plus an App Group in Xcode.

## 6. On-device checklist (please run once)
1. **Upgrade test:** install over an existing build that has photos.
   - Memories and meal photos still show.
   - Snapping new photos works.
   - The "Storage is full" banner no longer appears after many photos.
2. **Camera:** capture, gallery, and cancel all work. If you denied permission, the app shows a message.
3. **Face ID:** turn the lock on, background the app for more than 1 minute, and check that it asks for Face ID when you return.
4. **Notifications:** turn on the journal reminder at a time 2 minutes away and check that it arrives. Also check the rest timer notification while the app is in the background.
5. **Barcode:** scan a packaged food, check the values, and add it.
6. **Exports:**
   - Gym → Export workouts (CSV) opens the share sheet.
   - Health → Cycle report → Share opens the share sheet.
7. **Midnight:** leave the app open across midnight with text half-typed. The "new day" banner should appear and the text should stay.
8. **Snaps / Us / Meals (merged from your local build):** Snaps is full-screen with no header; after a photo you get Save Memory / Mark Food / Track Spending / Retake. In Us, Invite Partner shows a code, Copy/Share work. In Meals, Use My Location asks for permission and Open in Apple Maps leaves the app to Maps.
9. **Cloud (if configured):** on phone A, sign in and back up. Then sign in on phone B, check that the restore works, and check that pairing and sharing toggles control what the partner sees.
