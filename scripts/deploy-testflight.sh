#!/bin/bash
set -euo pipefail

# Deploy Whisker Health to TestFlight
#
# Usage: ./scripts/deploy-testflight.sh [--local | --cloud]
#
#   --local   Force local build (no EAS credits used)
#   --cloud   Force cloud build (EAS)
#   (default) Try cloud build; if quota exhausted, fall back to local
#
# This script:
# 1. Runs all tests (shared + worker + frontend + app)
# 2. Verifies the Expo web export compiles
# 3. Builds a production iOS binary (cloud or local)
# 4. Submits it to TestFlight via EAS Submit
# 5. Deploys the web frontend to Cloudflare Pages
# 6. Deploys the Worker if any worker/ files changed

cd "$(dirname "$0")/.."
ROOT=$(pwd)

# Parse arguments
BUILD_MODE="auto"  # auto | local | cloud
while [[ $# -gt 0 ]]; do
  case "$1" in
    --local)  BUILD_MODE="local";  shift ;;
    --cloud)  BUILD_MODE="cloud";  shift ;;
    *)        echo "Unknown option: $1"; echo "Usage: $0 [--local | --cloud]"; exit 1 ;;
  esac
done

echo "=== Whisker Health → TestFlight ==="
echo "Build mode: $BUILD_MODE"
echo ""

# 1. Run tests
echo "▸ Running shared tests..."
cd "$ROOT/shared" && npm test --silent 2>&1 | tail -1
echo "▸ Running worker tests..."
cd "$ROOT/worker" && npm test --silent 2>&1 | tail -1
echo "▸ Running frontend tests..."
cd "$ROOT/frontend" && npm test --silent 2>&1 | tail -1
echo "▸ Running app tests..."
cd "$ROOT/app" && npm test --silent 2>&1 | tail -1
echo ""

# 2. Verify Expo web export
echo "▸ Verifying Expo web export..."
cd "$ROOT/app" && npx expo export --platform web 2>&1 | grep "Exported"
echo ""

# 3. Build production iOS
BUILD_LOG="/tmp/eas-build.log"
IPA_PATH=""
USED_LOCAL=false

do_cloud_build() {
  echo "▸ Building production iOS binary (EAS Cloud)..."
  echo "  This takes ~5-10 minutes."
  cd "$ROOT/app"
  if npx eas build --platform ios --profile production --non-interactive 2>&1 | tee "$BUILD_LOG" | tail -5; then
    IPA_URL=$(grep -o 'https://expo.dev/artifacts/eas/[^ ]*\.ipa' "$BUILD_LOG" || true)
    if [ -n "$IPA_URL" ]; then
      echo ""
      echo "▸ Cloud build complete: $IPA_URL"
      return 0
    fi
  fi
  return 1
}

do_local_build() {
  echo "▸ Building production iOS binary (local)..."
  echo "  This may take several minutes on first run."
  cd "$ROOT/app"
  # --local builds on this machine, outputs an .ipa file
  if npx eas build --platform ios --profile production --local --non-interactive 2>&1 | tee "$BUILD_LOG" | tail -10; then
    # eas build --local prints the output path at the end
    IPA_PATH=$(grep -oE '/[^ ]*\.ipa' "$BUILD_LOG" | tail -1 || true)
    if [ -n "$IPA_PATH" ] && [ -f "$IPA_PATH" ]; then
      echo ""
      echo "▸ Local build complete: $IPA_PATH"
      USED_LOCAL=true
      return 0
    fi
  fi
  return 1
}

case "$BUILD_MODE" in
  cloud)
    if ! do_cloud_build; then
      echo "✗ Cloud build failed."
      exit 1
    fi
    ;;
  local)
    if ! do_local_build; then
      echo "✗ Local build failed."
      exit 1
    fi
    ;;
  auto)
    echo "▸ Attempting cloud build (will fall back to local if quota exhausted)..."
    if do_cloud_build; then
      : # success
    else
      # Check if the failure was due to quota
      if grep -q "used its iOS builds from the Free plan" "$BUILD_LOG" 2>/dev/null; then
        echo ""
        echo "⚠ EAS free plan quota exhausted. Falling back to local build..."
        echo ""
        if ! do_local_build; then
          echo "✗ Local build also failed."
          exit 1
        fi
      else
        echo "✗ Cloud build failed (not a quota issue). Check $BUILD_LOG"
        exit 1
      fi
    fi
    ;;
esac

# 4. Submit to TestFlight
echo "▸ Submitting to TestFlight..."
cd "$ROOT/app"
if [ "$USED_LOCAL" = true ]; then
  # Local build: submit the .ipa file by path
  npx eas submit --platform ios --path "$IPA_PATH" --non-interactive 2>&1 | tail -5
else
  # Cloud build: submit by URL
  npx eas submit --platform ios --url "$IPA_URL" --non-interactive 2>&1 | tail -5
fi
echo ""

# Log submission to docs/app-store-submissions.md
COMMIT_HASH=$(git rev-parse --short HEAD)
COMMIT_HASH_FULL=$(git rev-parse HEAD)
APP_VERSION=$(cd "$ROOT/app" && node -p "require('./app.json').expo.version" 2>/dev/null || echo "unknown")
SUBMIT_DATE=$(date +%Y-%m-%d)
SUBMIT_TIME=$(date +%H:%M:%S)
COMMIT_MSG=$(git log -1 --format='%s')
cat >> "$ROOT/docs/app-store-submissions.md" <<LOGEOF

## Version ${APP_VERSION} (Build ${SUBMIT_DATE})
- **Submitted**: ${SUBMIT_DATE} ${SUBMIT_TIME}
- **Commit**: ${COMMIT_HASH} (${COMMIT_HASH_FULL})
- **Commit message**: ${COMMIT_MSG}
- **App Store Connect**: https://appstoreconnect.apple.com/apps/6762031793/testflight/ios
- **Status**: Submitted to TestFlight
LOGEOF
echo "▸ Logged submission to docs/app-store-submissions.md (commit ${COMMIT_HASH})"
echo ""

# 5. Deploy web frontend
echo "▸ Deploying web frontend..."
cd "$ROOT/frontend" && npm run build --silent 2>&1 | tail -1
npx wrangler pages deploy dist --project-name cat-tracker --commit-dirty=true 2>&1 | tail -1
echo ""

# 6. Deploy Worker if worker/ or shared/ changed since last deploy.
# Uses a git tag to track when we last deployed the worker. Falls back to
# checking the last 10 commits if no deploy tag exists yet.
LAST_DEPLOY_TAG=$(git tag -l 'worker-deployed-*' --sort=-creatordate 2>/dev/null | head -1)
if [ -n "$LAST_DEPLOY_TAG" ]; then
  WORKER_CHANGED=$(git diff "$LAST_DEPLOY_TAG" --name-only -- worker/ shared/ 2>/dev/null | head -1)
else
  WORKER_CHANGED=$(git diff HEAD~10 --name-only -- worker/ shared/ 2>/dev/null | head -1)
fi
if [ -n "$WORKER_CHANGED" ]; then
  echo "▸ Worker or shared files changed — deploying..."
  cd "$ROOT/worker" && npx wrangler deploy 2>&1 | tail -1
  # Tag this commit so future runs know when the worker was last deployed
  git tag -f "worker-deployed-$(date +%Y%m%d%H%M%S)" HEAD 2>/dev/null || true
else
  echo "▸ No worker/shared changes since last deploy — skipping."
fi

echo ""
echo "=== Done ==="
echo "TestFlight build will be available in ~5-10 minutes after Apple processing."
echo "Check: https://appstoreconnect.apple.com/apps/6762031793/testflight/ios"
