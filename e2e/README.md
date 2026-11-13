# Browser smoke tests (iPhone-size viewport)

Playwright (playwright-core) against the production build, at 390×844 mobile emulation.

```bash
npm run build && npx vite preview --port 4173 &
CHROME_PATH=/path/to/chrome npm run test:e2e
```

- `test.mjs`: pass 1–2 flows (Snaps, rollover, meals, gym, plans, cycle, storage-full…)
- `test2.mjs`: pass 3 (photo migration, profile guard, wake prompt, samples, partner demo,
  midnight rollover, multi-set gym/CSV, cycle predictions/report, journal, settings,
  Together, quick add, barcode with a mocked Open Food Facts response, daily question)
- `test3.mjs`: features merged from local-latest (full-screen Snaps, gym completion, partner invite codes,
  nearby Maps hand-off, dark-mode inputs, legacy key compatibility)
- `test-cloud.mjs`: build with dummy `VITE_SUPABASE_*` + `VITE_ENABLE_AI_NUTRITION=true`,
  served on port 4174; checks cloud UI appears and AI requires sign-in.
