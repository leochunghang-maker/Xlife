# Pass 5 — app-lock lifecycle and AI request hardening

**Stacked on PR #5 (which depends on PR #4). Nothing is merged, enabled or
deployed by this work. Cloud/AI must stay disabled until review, ordered
migrations and a separately approved live-test rollout.** No user data is used
in automated tests; provider responses and image fixtures are synthetic.

## App lock

- Settings and AppLockGate now subscribe to the same setting-change source;
  enabling/disabling works immediately, without restarting. The existing
  `xlife_app_lock` key is unchanged. Storage-write failure cannot claim enablement.
- Enabling verifies biometrics/passcode once, saves only on success, and notifies
  the Gate that verification already occurred (no second enable prompt).
- A configured native lock starts locked and attempts authentication once on
  launch. Failure/cancellation stays locked. Unlock retries are explicit and
  coalesced. Missing native biometric capability fails closed for an enabled
  native lock. Reinstall a correctly built app over the existing app if recovery
  is needed; do not delete the app, storage keys or data as a workaround.
- `@capacitor/app` supplies native appStateChange/pause events. DOM visibility is
  a fallback. Inactive events obscure the UI immediately; biometric-prompt
  inactivity is not treated as a new background session. A genuine native pause
  records background time even during a prompt and invalidates earlier auth.
- After at least one minute in the background, returning shows the lock and
  requires **Unlock** (rather than auto-prompting on every active event). A prompt
  started before real background cannot later unlock the resumed app. Native
  handles resolving after cleanup are removed individually; other features'
  listeners are never removed with a global removeAllListeners call.
- The WebView shield hides/inerts children and blurs the active input, preserving
  mounted form state rather than unmounting user edits. **This is best-effort
  JavaScript UI privacy, NOT a guaranteed native snapshot/screenshot block.**
  Native event timing, keyboard/switcher snapshots, actual Face ID/passcode and
  OS interruptions require on-device verification. If native registration fails,
  DOM fallback cannot certify equivalent OS lifecycle coverage. Already-captured
  images cannot be recalled.
- Web does not claim to offer native Face ID or a secure biometric fallback.
  The lock is a UI access gate, not storage encryption or protection against
  arbitrary JS/device compromise.

Native wiring changed only to add CapacitorApp in the generated SPM package.
`npm run build` + `npx cap sync ios` were executed successfully on Linux. This is
not an Xcode compile or a signed-device install. Signing remains team
`2GTZ7KDKLY`, bundle `com.xlife.app`, display name `Xlife`.

## Atomic AI attempt quota

Apply `supabase/migrations/20261121000000_atomic_ai_quota.sql` **after** all prior
migrations, during a separately approved rollout with old AI invocation disabled.
It creates `ai_quota_config` and `ai_daily_usage`, retains historical `ai_requests`
and carries historical nutrition attempts into their original UTC day. Re-running
never lowers an existing spent counter. No local data/storage key is removed.

`reserve_nutrition_quota()` has **no owner, limit or date parameters**. It derives
the caller from verified `auth.uid()`, reads server-owned configuration, and
atomically inserts/increments one `(user_id, utc_day)` row only below the limit.
Concurrent callers cannot pass a count-then-insert race. Clients cannot mutate
counters/config or historic request logs. Anonymous/PUBLIC execution is revoked;
users can read only their own usage. Security-definer search_path and object
references are fixed. The Edge Function uses a JWT-scoped client, not a
service-role client; browser-supplied owner/limit fields are rejected.

Default: **30 valid attempts per UTC calendar day**, resetting at 00:00 UTC
(**08:00 Hong Kong time, UTC+8**), not the former rolling 24-hour window. The DB
clock at reservation start determines the day, not caller timezone/clock. A
successful reservation is an attempt, not a pending lease. Upstream errors,
timeouts or a disconnect after reservation still consume it; no refund endpoint
can be abused. Request/DB deadlines cancel waiting work, but a DB reservation
already committed may remain spent after HTTP cancellation.

`AI_DAILY_LIMIT` environment configuration is retired. A separately authorized
server administrator can set the protected singleton, for example:

```sql
-- Documentation only; not executed on any live project by this PR.
update public.ai_quota_config set daily_limit = 30 where singleton;
```

Missing config, DB errors, invalid RPC responses or DB timeouts **fail closed**:
no provider call. Malformed input is rejected before reserving an attempt.

## Edge request and response limits

- Existing `verify_jwt = true` remains; `auth.getUser()` also validates identity.
  Oversized/missing/invalid Authorization headers are rejected. Server-only
  `OPENAI_API_KEY` stays in function secrets; no service-role key is needed by
  this handler, and no server secret is added to VITE_ variables.
- Only JSON POST bodies with string `image` and optional string `note` (<=300
  UTF-16 code units); no caller owner/limit or unknown fields.
- Streamed bytes are counted **before parsing**, regardless of Content-Length,
  with a fixed bounded buffer and read deadline. Maximum JSON bytes: 2,674,860.
  Decoded image maximum: 2,000,000 bytes. Canonical base64 decoding, declared
  MIME/magic/structural header consistency and dimensions are validated for
  static JPEG/PNG/WebP. Max edge 12,000 px and max area 40,000,000 pixels.
- This is header/structure checking, **not** a full image decoder/CRC/malware
  scan. The provider may still reject corrupt image contents. Animations are
  rejected. No default or fabricated estimate replaces a failed analysis.
- Deadlines: auth 5s, body read 5s, quota DB 5s, provider 20s (including response
  body). Responses from the provider are bounded to 64 KB and checked for the
  exact expected schema, sane numeric/string limits and non-food consistency.
- Approximate success results remain for user review/edit. Safe errors use JSON
  + no-store; no raw provider/DB error text, images, credentials or JWTs are logged
  or echoed. Timeout gives 504, quota exhausted 429 (UTC reset explained), quota
  unavailable 503; malformed input/oversize give 400/413. Provider malformed or
  rejected output gives 502; unexpected network errors give safe generic 503.

## Tests and remaining verification

```sh
npm ci
npm run lint
npm run build
npx cap sync ios
# Existing full browser suite needs a production preview on port 4173:
npm run preview -- --port 4173
npm run test:e2e             # includes pure/mock-native lock tests
npm run test:lock            # independently self-starts its mock-native server
npm run test:ai              # deno check + no-network Deno unit tests
npm run test:security        # cloud mocks + isolated SQL, including AI quota
```

The lock test Vite config aliases native plugins **only in that test server**;
production config imports no mocks. Tests cover same-session toggles, launch,
resume, shield/failure/cancel/retry, missing capability and late listener cleanup.
Mock native is **not real Face ID verification**.

AI tests inject auth/DB/upstream. SQL tests actually run authenticated/anon role
privilege checks and **40 separate concurrent psql connections** with artificial
INSERT overlap: exactly **7 allowed, 33 denied, persisted attempts 7**. They also
check UTC/date isolation, DB failure, owner spoof denial, historical backfill and
re-run safety. Synthetic privileged setup is separate from authenticated attacks.

Still not verified: physical iPhone, Xcode compile, Face ID/passcode cancellation
on device, OS snapshots, live Supabase/PostgREST/RLS integration, real provider
response compatibility/quality. The preserved default `gpt-4o-mini` is marked
deprecated in the [provider's model documentation](https://developers.openai.com/api/docs/models/gpt-4o-mini)
opened during this pass; select and verify an available compatible model in a
separately approved rollout rather than silently changing model/cost here. No paid API call or deployment occurred. A
controlled future rollout must also evaluate gateway/request-rate/concurrency
limits (daily quota alone is not a full DoS defense), retention/cleanup policy
for daily usage history, and any migration from old rolling-window limits.
