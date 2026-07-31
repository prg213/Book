/**
 * React Native autolinking config.
 *
 * @solana-mobile/mobile-wallet-adapter-protocol is a transitive dependency pulled
 * in by @clerk/clerk-js (via @solana-mobile/wallet-adapter-mobile). Its android/
 * build.gradle references 'com.android.tools.build:gradle:9.2.1' — a version that
 * does not exist — causing Gradle to fail. We don't need this native module so we
 * block it from being autolinked.
 */
module.exports = {
  dependencies: {
    '@solana-mobile/mobile-wallet-adapter-protocol': {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
