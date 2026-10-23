# Rift Rush

A neon arcade game with 60-second Rush, UTC Daily Rift, Endless mode, cosmetic unlocks, mobile controls, sound, pause/resume, challenge links, and downloadable score cards. Original artwork is rendered on a short-lived rented GPU; gameplay runs locally on each player's device.

`public/` is the shared game source. `backend/service.mjs` implements signed run tickets, deterministic score verification, and bounded leaderboard access. `app/` exposes the backend through Vinext/Cloudflare Workers, and `drizzle/` contains the D1 migration. `native/android/` is the Android package, while `native/ios/` contains the iPhone source and XcodeGen project definition.

Run with Node 24 or newer:

```sh
npm ci
npm test
npm run db:generate
npm run build
# Apply only unapplied local migrations using the generated Wrangler config.
node --import ./scripts/sites-env.mjs node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_peaceful_daimon_hellstrom.sql
npm run dev -- --port 4188 --hostname 127.0.0.1
```

Create an ignored `.dev.vars` containing a randomly generated `RUN_SIGNING_KEY` of at least 32 characters for local online scores. Configure the production secret using the hosting provider's secret manager. Never put it in `public/` or commit it. The tracked hosting manifest retains this Site's project identity and declares `DB`.

`tools/browser_qa.py` exercises desktop, mobile, a complete run, offline play, sharing, and persistence using Playwright. `tests/` covers deterministic gameplay, replay/ticket abuse, and advertising fallback behavior. Test artifacts are excluded from the source repository.

Android: set `native/android/local.properties` to your SDK path and run Gradle 8.14.3 with `-p native/android assembleDebug bundleRelease`. The debug APK is installable and uses test ad IDs. The release bundle is unsigned and has ad requests disabled unless valid production IDs are supplied.

iPhone: run `python3 tools/package_ios.py`, then `xcodegen generate` in `native/ios`, open `RiftRush.xcodeproj` in Xcode 16+, choose an owner signing team, and build. No signed iPhone binary is included.

Read [capacity limits](docs/CAPACITY.md) before planning a large launch, and [monetization setup](docs/MONETIZATION.md) before enabling real advertising. This release has not been proven at 100,000 concurrent users and has not earned revenue.
