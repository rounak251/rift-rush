# Monetization setup

No publisher account or payout destination was supplied. **Live ads are disabled and no earnings have been generated.** Test ads are configured only in debug phone builds. The web version has an optional creator-support URL and a separate CrazyGames portal build; neither represents an approved advertising account.

Android debug builds use Google's official test application, interstitial, and rewarded-ad IDs. The source requests UMP consent before initializing ads. Interstitials can appear only between runs, after at least three minutes. A player can opt into a rewarded ad for 10 local cosmetic shards; it never changes the ranked score. Dismissal, no fill, load failure, and denied consent must leave the next run available. Release builds keep ad requests disabled without owner-provided production IDs.

The iPhone project has the equivalent consent and ad flow. It has not been compiled or run on this Mac because Xcode is absent. Debug uses test IDs; Release is disabled until its configuration is updated and tested.

To receive real ad revenue:

1. Create your own [AdMob account](https://admob.google.com/home/), complete the required account/payment steps, and add the Android and iOS apps.
2. Create one interstitial and one rewarded ad unit per platform, and configure Privacy & messaging in AdMob. Use the real app ID in the Android manifest build input and iOS Info.plist. Ad IDs are public configuration; passwords, service-account files, and API keys are not needed here.
3. Android: supply `-PadmobAppId=... -PinterstitialAdUnitId=... -PrewardedAdUnitId=...` to the release build. All three IDs must use the same publisher. Configure owner-managed release signing; the delivered AAB is unsigned.
4. iOS: update `GADApplicationIdentifier`, the Release ad-unit constants, and `adsEnabled` only after approval. Resolve the Swift packages, compile in Xcode, sign with the owner's Apple team, and run device tests.
5. Complete the platform's privacy/data-safety declarations based on the SDKs actually enabled. Publish a reachable privacy policy, app-ads.txt where required, and approved store listings. Review the target audience and ad settings before launch.
6. Keep test devices/test IDs during development. Do not click production ads or manufacture impressions. Review revenue and payout status in AdMob; estimated revenue, finalized revenue, and paid-out money are different states.

Current implementation references:

- [Android test ads](https://developers.google.com/admob/android/test-ads)
- [Android consent and ad eligibility](https://developers.google.com/admob/android/privacy)
- [iOS SDK setup](https://developers.google.com/admob/ios/quick-start)
- [iOS consent](https://developers.google.com/admob/ios/privacy)

For the web game, run `python3 tools/package_portal.py` to make `artifacts/rift-rush-portal-basic.zip`. It contains the optional CrazyGames SDK adapter with ads disabled. Review it in the publisher's preview tool before submitting. CrazyGames Basic Launch does not share ad revenue; monetization requires selection for Full Launch and the publisher's checks. No portal submission or approval has been performed.

- [CrazyGames launch process](https://docs.crazygames.com/)
- [CrazyGames advertising requirements](https://docs.crazygames.com/requirements/ads/)

A direct creator-support option can be activated by placing a valid public HTTPS payment page in `public/config.json` under `supportUrl`, then deploying again. This does not require storing payment keys in the game.
