#!/bin/bash
set -euo pipefail

# Build Whisker Health iOS IPA for TestFlight.
#
# Usage: ./scripts/build-ios.sh [--local | --cloud]
#
#   --local   Build locally (no EAS credits used) — DEFAULT
#   --cloud   Build via EAS cloud (uses free-plan credits)
#
# Steps:
#   1. Run all 4 test suites (shared + worker + frontend + app)
#   2. Verify the Expo web export compiles
#   3. Deploy the web frontend to Cloudflare Pages
#   4. Deploy the Worker if worker/ or shared/ changed
#   5. Build a production iOS IPA (local or cloud)
#   6. Write build metadata to BUILD_INFO_FILE so submit-testflight.sh can pick it up
#
# On success, prints the path to BUILD_INFO_FILE. On failure, prints the build log path.

cd "$(dirname "$0")/.."
ROOT=$(pwd)

BUILD_INFO_FILE="${BUILD_INFO_FILE:-/tmp/whisker-build-info.env}"
BUILD_LOG="${BUILD_LOG:-/tmp/whisker-eas-build.log}"

BUILD_MODE="local"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --local)  BUILD_MODE="local"; shift ;;
    --cloud)  BUILD_MODE="cloud"; shift ;;
    -h|--help)
      grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "✗ Unknown option: $1" >&2; echo "Usage: $0 [--local | --cloud]" >&2; exit 2 ;;
  esac
done

fail() {
  echo "" >&2
  echo "✗ $*" >&2
  exit 1
}

echo "=== Whisker Health → iOS Build ==="
echo "Build mode: $BUILD_MODE"
echo "Build info: $BUILD_INFO_FILE"
echo "Build log:  $BUILD_LOG"
echo ""

# ----- 1. Tests -----
run_tests() {
  local dir="$1" label="$2"
  echo "▸ Running ${label} tests..."
  if ! (cd "$ROOT/$dir" && npm test --silent); then
    fail "${label} tests failed. Fix them before building."
  fi
}

run_tests shared   "shared"
run_tests worker   "worker"
run_tests frontend "frontend"
run_tests app      "app"
echo ""

# ----- 2. Expo web export sanity check -----
echo "▸ Verifying Expo web export..."
EXPORT_LOG="/tmp/whisker-expo-export.log"
if ! (cd "$ROOT/app" && npx expo export --platform web) >"$EXPORT_LOG" 2>&1; then
  tail -30 "$EXPORT_LOG" >&2
  fail "Expo web export failed. Full log: $EXPORT_LOG"
fi
grep "Exported" "$EXPORT_LOG" || fail "Expo web export did not report success. Log: $EXPORT_LOG"
echo ""

# ----- 3. Deploy web frontend -----
echo "▸ Building web frontend..."
if ! (cd "$ROOT/frontend" && npm run build --silent); then
  fail "Frontend build failed."
fi
echo "▸ Deploying web frontend to Cloudflare Pages..."
if ! (cd "$ROOT/frontend" && npx wrangler pages deploy dist --project-name cat-tracker --commit-dirty=true); then
  fail "Frontend Pages deploy failed."
fi
echo ""

# ----- 4. Deploy worker if changed -----
LAST_DEPLOY_TAG=$(git tag -l 'worker-deployed-*' --sort=-creatordate 2>/dev/null | head -1)
if [ -n "$LAST_DEPLOY_TAG" ]; then
  WORKER_CHANGED=$(git diff "$LAST_DEPLOY_TAG" --name-only -- worker/ shared/ 2>/dev/null | head -1)
else
  WORKER_CHANGED=$(git diff HEAD~10 --name-only -- worker/ shared/ 2>/dev/null | head -1)
fi
if [ -n "$WORKER_CHANGED" ]; then
  echo "▸ Worker/shared changed — deploying Worker..."
  if ! (cd "$ROOT/worker" && npx wrangler deploy); then
    fail "Worker deploy failed."
  fi
  git tag -f "worker-deployed-$(date +%Y%m%d%H%M%S)" HEAD 2>/dev/null || true
else
  echo "▸ No worker/shared changes since last deploy — skipping Worker deploy."
fi
echo ""

# ----- 5. Build IPA -----
: > "$BUILD_LOG"

do_cloud_build() {
  echo "▸ Building production iOS binary (EAS Cloud)..."
  echo "  Log: $BUILD_LOG"
  cd "$ROOT/app"
  # pipefail is set; capture full log, stream to terminal via tee
  if ! npx eas build --platform ios --profile production --non-interactive 2>&1 | tee "$BUILD_LOG"; then
    return 1
  fi
  IPA_URL=$(grep -oE 'https://expo\.dev/artifacts/eas/[^ ]*\.ipa' "$BUILD_LOG" | tail -1 || true)
  if [ -z "$IPA_URL" ]; then
    echo "✗ Cloud build finished but no IPA URL was found in the log." >&2
    echo "  Inspect: $BUILD_LOG" >&2
    return 1
  fi
  echo "▸ Cloud build complete: $IPA_URL"
  return 0
}

do_local_build() {
  echo "▸ Building production iOS binary (local)..."
  echo "  First run can take 10-15 minutes. Log: $BUILD_LOG"
  cd "$ROOT/app"
  if ! npx eas build --platform ios --profile production --local --non-interactive 2>&1 | tee "$BUILD_LOG"; then
    return 1
  fi
  IPA_PATH=$(grep -oE '/[^ ]*\.ipa' "$BUILD_LOG" | tail -1 || true)
  if [ -z "$IPA_PATH" ]; then
    echo "✗ Local build finished but no .ipa path was found in the log." >&2
    echo "  Inspect: $BUILD_LOG" >&2
    return 1
  fi
  if [ ! -f "$IPA_PATH" ]; then
    echo "✗ Log reported IPA at $IPA_PATH but file does not exist." >&2
    return 1
  fi
  echo "▸ Local build complete: $IPA_PATH"
  return 0
}

IPA_URL=""
IPA_PATH=""

case "$BUILD_MODE" in
  cloud)
    do_cloud_build || fail "Cloud build failed. See $BUILD_LOG"
    ;;
  local)
    do_local_build || fail "Local build failed. See $BUILD_LOG"
    ;;
esac

# ----- 6. Persist build info for the submit script -----
COMMIT_HASH=$(git rev-parse --short HEAD)
COMMIT_HASH_FULL=$(git rev-parse HEAD)
APP_VERSION=$(cd "$ROOT/app" && node -p "require('./app.json').expo.version" 2>/dev/null || echo "unknown")
COMMIT_MSG=$(git log -1 --format='%s' | tr -d '"')
BUILT_AT=$(date +%Y-%m-%dT%H:%M:%S%z)

{
  echo "# Generated by scripts/build-ios.sh — consumed by scripts/submit-testflight.sh"
  echo "BUILD_MODE=\"$BUILD_MODE\""
  echo "IPA_URL=\"${IPA_URL}\""
  echo "IPA_PATH=\"${IPA_PATH}\""
  echo "COMMIT_HASH=\"$COMMIT_HASH\""
  echo "COMMIT_HASH_FULL=\"$COMMIT_HASH_FULL\""
  echo "APP_VERSION=\"$APP_VERSION\""
  echo "COMMIT_MSG=\"$COMMIT_MSG\""
  echo "BUILT_AT=\"$BUILT_AT\""
  echo "BUILD_LOG=\"$BUILD_LOG\""
} > "$BUILD_INFO_FILE"

echo ""
echo "=== Build complete ==="
echo "Info written to: $BUILD_INFO_FILE"
echo "Next: ./scripts/submit-testflight.sh"
