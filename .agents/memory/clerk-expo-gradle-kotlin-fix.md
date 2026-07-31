---
name: Clerk Expo Gradle Kotlin metadata fix
description: Why @clerk/expo breaks Gradle builds in Expo SDK 54 and how to fix it
---

## The rule
Always add `"@clerk/expo"` to the `plugins` array in `app.json` when using `@clerk/expo` in an Expo project.

**Why:** `clerk-android` SDK (the native dependency of `@clerk/expo`) ships Kotlin 2.3.x metadata, but Expo SDK 54/55 uses Kotlin 2.1.x. This mismatch causes a silent Gradle failure (`EAS_BUILD_UNKNOWN_GRADLE_ERROR`). The `clerk-expo` `android/build.gradle` tries to patch this via a `rootProject.allprojects` hack, but that silently fails under newer Gradle/Isolated Projects. The `app.plugin.js` config plugin (`withClerkAndroid`) applies the fix reliably via `withAppBuildGradle`.

**How to apply:** In `app.json`:
```json
"plugins": [
  "@clerk/expo",
  ...
]
```
This runs `withClerkAndroid` during `expo prebuild`, injecting `-Xskip-metadata-version-check` into the app's `build.gradle` so the Kotlin 2.1.x compiler can read 2.3.x library metadata without failing.

**Additional root cause (the actual blocker):** `@clerk/clerk-js` (pulled in by `@clerk/expo`) transitively depends on `@solana-mobile/wallet-adapter-mobile` → `@solana-mobile/mobile-wallet-adapter-protocol`. That last package has an `android/build.gradle` with `classpath 'com.android.tools.build:gradle:9.2.1'` — a version that does not exist — causing Gradle to fail silently.

**Fix:** Add a `react-native.config.js` at the Expo app root (`artifacts/mystorybook-native/react-native.config.js`) to exclude `@solana-mobile/mobile-wallet-adapter-protocol` from autolinking:
```js
module.exports = {
  dependencies: {
    '@solana-mobile/mobile-wallet-adapter-protocol': {
      platforms: { android: null, ios: null },
    },
  },
};
```
This resolves after 7+ failed builds. The Kotlin 2.3.x metadata issue in `@clerk/expo` was a red herring — add `"@clerk/expo"` to `app.json` plugins regardless, as it also applies a needed META-INF packaging exclusion and the `@clerk/expo` config plugin is required.
