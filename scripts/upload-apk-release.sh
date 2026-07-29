#!/usr/bin/env bash
# Polls EAS for the APK build, downloads it, then creates a GitHub release.
# Usage: EXPO_TOKEN=xxx GITHUB_PAT=xxx bash scripts/upload-apk-release.sh

set -euo pipefail

BUILD_ID="52091367-5ff5-4f2b-af9e-d728ef75fc8f"
GITHUB_REPO="prg213/Book"
APK_PATH="/tmp/mystorybook.apk"
VERSION="v1.0.0-$(date +%Y%m%d)"

echo "⏳ Waiting for EAS build $BUILD_ID to finish..."

while true; do
  STATUS=$(cd artifacts/mystorybook-native && EXPO_TOKEN="$EXPO_TOKEN" npx eas-cli build:view "$BUILD_ID" --json 2>/dev/null | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "unknown")
  APK_URL=$(cd artifacts/mystorybook-native && EXPO_TOKEN="$EXPO_TOKEN" npx eas-cli build:view "$BUILD_ID" --json 2>/dev/null | grep -o '"applicationArchiveUrl":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "null")

  echo "  Status: $STATUS"

  if [ "$STATUS" = "finished" ] && [ "$APK_URL" != "null" ] && [ -n "$APK_URL" ]; then
    echo "✅ Build finished!"
    break
  elif [ "$STATUS" = "errored" ] || [ "$STATUS" = "cancelled" ]; then
    echo "❌ Build $STATUS. Check https://expo.dev/accounts/prg123s-team/projects/mystorybook-native/builds/$BUILD_ID"
    exit 1
  fi

  echo "  Waiting 30s..."
  sleep 30
done

echo "⬇️  Downloading APK from: $APK_URL"
curl -L -o "$APK_PATH" "$APK_URL"
echo "✅ APK downloaded ($(du -h "$APK_PATH" | cut -f1))"

# Create GitHub release
echo "🚀 Creating GitHub release $VERSION..."
RELEASE_RESPONSE=$(curl -s -X POST \
  -H "Authorization: token $GITHUB_PAT" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/$GITHUB_REPO/releases" \
  -d "{
    \"tag_name\": \"$VERSION\",
    \"name\": \"MyStoryBook Android $VERSION\",
    \"body\": \"## MyStoryBook Android APK\n\nDownload and install the APK directly on your Android device.\n\n> Enable 'Install from unknown sources' in Android settings if prompted.\",
    \"draft\": false,
    \"prerelease\": false
  }")

RELEASE_ID=$(echo "$RELEASE_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "  Release ID: $RELEASE_ID"

# Upload APK as release asset
echo "📤 Uploading APK to release..."
UPLOAD_URL="https://uploads.github.com/repos/$GITHUB_REPO/releases/$RELEASE_ID/assets?name=MyStoryBook.apk"
curl -s -X POST \
  -H "Authorization: token $GITHUB_PAT" \
  -H "Content-Type: application/vnd.android.package-archive" \
  --data-binary @"$APK_PATH" \
  "$UPLOAD_URL" | grep -o '"browser_download_url":"[^"]*"' | cut -d'"' -f4

echo "✅ Done! APK is now available as a GitHub release on $GITHUB_REPO"
