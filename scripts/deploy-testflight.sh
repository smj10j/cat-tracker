#!/bin/bash
set -euo pipefail

# Deploy Whisker Health to TestFlight
# Usage: ./scripts/deploy-testflight.sh
#
# This script:
# 1. Runs all tests (worker + frontend)
# 2. Verifies the Expo web export compiles
# 3. Builds a production iOS binary via EAS Build
# 4. Submits it to TestFlight via EAS Submit
# 5. Deploys the web frontend to Cloudflare Pages
# 6. Deploys the Worker if any worker/ files changed

cd "$(dirname "$0")/.."
ROOT=$(pwd)

echo "=== Whisker Health → TestFlight ==="
echo ""

# 1. Run tests
echo "▸ Running worker tests..."
cd "$ROOT/worker" && npm test --silent 2>&1 | tail -1
echo "▸ Running frontend tests..."
cd "$ROOT/frontend" && npm test --silent 2>&1 | tail -1
echo ""

# 2. Verify Expo web export
echo "▸ Verifying Expo web export..."
cd "$ROOT/app" && npx expo export --platform web 2>&1 | grep "Exported"
echo ""

# 3. Build production iOS
echo "▸ Building production iOS binary (EAS Build)..."
echo "  This takes ~5-10 minutes. You'll see a URL when done."
cd "$ROOT/app" && npx eas build --platform ios --profile production --non-interactive 2>&1 | tee /tmp/eas-build.log | tail -5

# Extract build URL from log
BUILD_URL=$(grep -o 'https://expo.dev/artifacts/eas/[^ ]*\.ipa' /tmp/eas-build.log || true)

if [ -z "$BUILD_URL" ]; then
  echo ""
  echo "⚠ Could not extract build URL automatically."
  echo "  Check https://expo.dev/accounts/smj10j/projects/whisker-health/builds"
  echo "  Then run: cd app && npx eas submit --platform ios --latest --non-interactive"
  exit 1
fi

echo ""
echo "▸ Build complete: $BUILD_URL"

# 4. Submit to TestFlight
echo "▸ Submitting to TestFlight..."
cd "$ROOT/app" && npx eas submit --platform ios --url "$BUILD_URL" --non-interactive 2>&1 | tail -5
echo ""

# 5. Deploy web frontend
echo "▸ Deploying web frontend..."
cd "$ROOT/frontend" && npm run build --silent 2>&1 | tail -1
npx wrangler pages deploy dist --project-name cat-tracker --commit-dirty=true 2>&1 | tail -1
echo ""

# 6. Deploy Worker if changed
WORKER_CHANGED=$(git diff HEAD~1 --name-only -- worker/ 2>/dev/null | head -1)
if [ -n "$WORKER_CHANGED" ]; then
  echo "▸ Worker files changed — deploying..."
  cd "$ROOT/worker" && npx wrangler deploy 2>&1 | tail -1
else
  echo "▸ No worker changes — skipping deploy."
fi

echo ""
echo "=== Done ==="
echo "TestFlight build will be available in ~5-10 minutes after Apple processing."
echo "Check: https://appstoreconnect.apple.com/apps/6762031793/testflight/ios"
