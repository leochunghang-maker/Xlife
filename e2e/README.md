# Browser smoke tests (iPhone-size viewport)

Playwright (playwright-core) against the production build, at 390×844 mobile emulation.

```bash
npm run build && npx vite preview --port 4173 &
CHROME_PATH=/path/to/chrome npm run test:e2e
```

- `test-unit.mjs`: backup merge helpers, blank same-day restore, cross-day multi-set rollover (no browser)
- `test.mjs`: pass 1–2 flows (Snaps, rollover, meals, gym, plans, cycle, storage-full…)
- `test2.mjs`: pass 3 (photo migration, profile guard, wake prompt, samples, partner demo,
  midnight rollover, multi-set gym/CSV, cycle predictions/report, journal, settings,
  Together, quick add, barcode with a mocked Open Food Facts response, daily question)
- `test3.mjs`: features merged from local-latest (full-screen Snaps, gym completion, partner invite codes,
  nearby Maps hand-off, dark-mode inputs, legacy key compatibility)
- `test4.mjs`: confirmed snap save, Settings export/restore (photos + My foods / Together), rollover clears `sets[].done`
- `test-cloud.mjs`: build with dummy `VITE_SUPABASE_*` + `VITE_ENABLE_AI_NUTRITION=true`,
  served on port 4174; checks cloud UI appears and AI requires sign-in.

## Cloud/account security (synthetic, no real service)

`npm run test:security` starts/stops its own dummy-config Vite server on 4185,
runs the existing cloud configuration smoke plus `test-security.mjs`, then
actually executes `test:sql` against disposable embedded PostgreSQL. Requires
Chrome and `psql` on PATH. Uses `.invalid` host interception and synthetic
accounts/tokens; does not enable or deploy cloud/AI. All failures exit nonzero.
See `docs/SECURITY_MODEL.md` for coverage and limitations. The normal production
`npm run build` remains local-only without cloud configuration.
