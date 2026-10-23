# Rift Rush

A neon arcade game with Rift Assault as its default mode. Version 2.2 (Arsenal) adds shield carriers, telegraphed lane-switching drones, a Sentinel elite at 26 seconds, and six upgrade synergies. Destroy carriers to remove escort shields; defeat the Sentinel before 40 seconds for 800 bonus points, three cosmetic shards, and a shield. The second draft always offers a partner upgrade for your first choice and previews its synergy: Crossfire (Twin cannon + Wingmen), Feedback loop (Overclock + Nova reactor), Field medic (Second wind + Salvage field), Aegis burst (Second wind + Nova reactor), Core breaker (Twin cannon + Nova reactor), or Salvage squad (Wingmen + Salvage field). The game also includes eight-kill power surges with six seconds of faster fire and double kill points, six upgrades offered in seeded three-card drafts, an enraged second boss phase, pilot XP/ranks, run grades, and six permanent cosmetic medals. Career rewards settle once per completed run and never change ranked ship stats. The core combat includes automatic cannons, six regular enemy types, kill chains, repair and charge pickups, a screen-clearing nova bomb, two mid-run upgrade choices, and a telegraphed boss encounter. Steer to aim, choose a build at 18 and 34 seconds, and defeat the Rift Warden before 75 seconds. Retry the same seed or choose a new enemy formation.

The classic 60-second Rush, UTC Daily Rift, and Endless modes remain available alongside cosmetic unlocks, daily missions, sound, pause/resume, challenge links, and downloadable score cards. Existing progress and version-1 classic challenge links remain compatible. New Assault links include `m=assault&av=3` and use the `assault-v3` leaderboard. Version-2 links, tickets, and app clients keep their frozen Overdrive rules and `assault-v2` board. Old `m=assault` links, app clients without a combat version, pending tickets, and the `assault-v1` board retain the frozen 2.0 rules. Saved 2.0 bests remain in `bests.assault`; Overdrive records use `bests.assault2`; Arsenal records use `bests.assault3`. Career XP and medals continue across both updates. Original background artwork was rendered on a short-lived rented GPU; gameplay runs locally on each player's device.

`public/` is the shared game source. `assault.js` owns deterministic Arsenal combat; `assault-legacy.js` and `assault-overdrive-v2.js` freeze the historical rules; `career.js` settles local XP and medals and `assault-render.js` draws its arena. The server replays upgrade choices along with steering and nova inputs. `public/missions.js` owns bounded local mission progress; rewards settle once per completed run and never affect ranked scores. Mission dates use UTC and credit the day the run finishes. `backend/service.mjs` implements signed run tickets, deterministic score verification, and bounded leaderboard access. `app/` exposes the backend through Vinext/Cloudflare Workers, and `drizzle/` contains the D1 migration. `native/android/` is the Android package, while `native/ios/` contains the iPhone source and XcodeGen project definition.

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

`tools/arsenal_qa.py` plays the new tactical enemies, elite encounter, and synergy draft through real mobile controls and verifies the finished replay. `tools/overdrive_qa.py` exercises the previous power surge, seeded draft, boss phase, XP/medal settlement, and reload persistence. `tools/assault_qa.py` exercises an entire legacy mobile boss fight using real inputs, both upgrade choices, server verification, offline play, and a new formation. `tools/browser_qa.py` checks classic desktop/mobile gameplay, a complete run, sharing, and persistence; `tools/improvement_qa.py` checks missions, saved-profile migration, countdown, and touch controls. `tests/` covers deterministic gameplay, replay/ticket abuse, and advertising fallback behavior. Test artifacts are excluded from the source repository.

Android: set `native/android/local.properties` to your SDK path and run Gradle 8.14.3 with `-p native/android assembleDebug bundleRelease`. The debug APK is installable and uses test ad IDs. The release bundle is unsigned and has ad requests disabled unless valid production IDs are supplied.

iPhone: run `python3 tools/package_ios.py`, then `xcodegen generate` in `native/ios`, open `RiftRush.xcodeproj` in Xcode 16+, choose an owner signing team, and build. No signed iPhone binary is included.

Read [capacity limits](docs/CAPACITY.md) before planning a large launch, and [monetization setup](docs/MONETIZATION.md) before enabling real advertising. This release has not been proven at 100,000 concurrent users and has not earned revenue.
