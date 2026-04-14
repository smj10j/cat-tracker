#!/bin/bash
set -euo pipefail

# Submit a previously-built Whisker Health IPA to TestFlight and log the submission.
#
# Usage: ./scripts/submit-testflight.sh [--info-file PATH]
#
# Reads build metadata written by scripts/build-ios.sh (default: /tmp/whisker-build-info.env),
# runs `eas submit`, verifies the submission reached Apple, then appends a TestFlight entry
# to docs/app-store-submissions.md.
#
# Idempotency: after a successful submit, the info file is renamed with a .submitted suffix
# so re-running the script doesn't double-submit. Pass --info-file to point at a specific
# build if you need to retry.

cd "$(dirname "$0")/.."
ROOT=$(pwd)

BUILD_INFO_FILE="${BUILD_INFO_FILE:-/tmp/whisker-build-info.env}"
SUBMIT_LOG="${SUBMIT_LOG:-/tmp/whisker-eas-submit.log}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --info-file) BUILD_INFO_FILE="$2"; shift 2 ;;
    -h|--help)
      grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "✗ Unknown option: $1" >&2; echo "Usage: $0 [--info-file PATH]" >&2; exit 2 ;;
  esac
done

fail() {
  echo "" >&2
  echo "✗ $*" >&2
  exit 1
}

echo "=== Whisker Health → TestFlight submit ==="
echo "Info file: $BUILD_INFO_FILE"
echo "Submit log: $SUBMIT_LOG"
echo ""

[ -f "$BUILD_INFO_FILE" ] || fail "Build info file not found: $BUILD_INFO_FILE
Run ./scripts/build-ios.sh first, or pass --info-file PATH to point at an existing build."

# shellcheck disable=SC1090
source "$BUILD_INFO_FILE"

: "${BUILD_MODE:?BUILD_MODE missing from $BUILD_INFO_FILE}"
: "${COMMIT_HASH:?COMMIT_HASH missing from $BUILD_INFO_FILE}"
: "${COMMIT_HASH_FULL:?COMMIT_HASH_FULL missing from $BUILD_INFO_FILE}"
: "${APP_VERSION:?APP_VERSION missing from $BUILD_INFO_FILE}"
: "${COMMIT_MSG:?COMMIT_MSG missing from $BUILD_INFO_FILE}"

echo "Build mode:   $BUILD_MODE"
echo "App version:  $APP_VERSION"
echo "Commit:       $COMMIT_HASH ($COMMIT_HASH_FULL)"
echo "Commit msg:   $COMMIT_MSG"
echo ""

# Validate we have an artifact to submit
case "$BUILD_MODE" in
  local)
    [ -n "${IPA_PATH:-}" ] || fail "Local build but IPA_PATH is empty in $BUILD_INFO_FILE"
    [ -f "$IPA_PATH" ] || fail "IPA not found at $IPA_PATH (was it moved or deleted?)"
    echo "▸ Submitting local IPA: $IPA_PATH"
    ;;
  cloud)
    [ -n "${IPA_URL:-}" ] || fail "Cloud build but IPA_URL is empty in $BUILD_INFO_FILE"
    echo "▸ Submitting cloud IPA: $IPA_URL"
    ;;
  *)
    fail "Unknown BUILD_MODE: $BUILD_MODE"
    ;;
esac

# ----- Run eas submit -----
: > "$SUBMIT_LOG"
cd "$ROOT/app"

set +e
if [ "$BUILD_MODE" = "local" ]; then
  npx eas submit --platform ios --path "$IPA_PATH" --non-interactive 2>&1 | tee "$SUBMIT_LOG"
  SUBMIT_STATUS=${PIPESTATUS[0]}
else
  npx eas submit --platform ios --url "$IPA_URL" --non-interactive 2>&1 | tee "$SUBMIT_LOG"
  SUBMIT_STATUS=${PIPESTATUS[0]}
fi
set -e

if [ "$SUBMIT_STATUS" -ne 0 ]; then
  echo "" >&2
  echo "✗ eas submit exited with status $SUBMIT_STATUS" >&2
  echo "  Full log: $SUBMIT_LOG" >&2
  echo "  Build info preserved at: $BUILD_INFO_FILE" >&2
  echo "  Retry with: ./scripts/submit-testflight.sh --info-file $BUILD_INFO_FILE" >&2
  exit 1
fi

# eas submit can exit 0 without actually submitting if something unusual happens.
# Confirm the log shows a successful submission.
if ! grep -Eqi 'Submitted your app|submission was successfully|has been successfully submitted|Ready for App Store Connect' "$SUBMIT_LOG"; then
  echo "" >&2
  echo "✗ eas submit exited 0 but the log does not contain a success marker." >&2
  echo "  This usually means the submission stalled or hit an unexpected state." >&2
  echo "  Inspect: $SUBMIT_LOG" >&2
  echo "  Check App Store Connect: https://appstoreconnect.apple.com/apps/6762031793/testflight/ios" >&2
  echo "  Build info preserved at: $BUILD_INFO_FILE" >&2
  exit 1
fi

echo ""
echo "▸ Submit succeeded."

# ----- Append entry to docs/app-store-submissions.md -----
SUBMIT_DATE=$(date +%Y-%m-%d)
SUBMIT_TIME=$(date +%H:%M:%S)
LOG_FILE="$ROOT/docs/app-store-submissions.md"

cat >> "$LOG_FILE" <<LOGEOF

## Version ${APP_VERSION} (Build ${SUBMIT_DATE})
- **Submitted**: ${SUBMIT_DATE} ${SUBMIT_TIME}
- **Commit**: ${COMMIT_HASH} (${COMMIT_HASH_FULL})
- **Commit message**: ${COMMIT_MSG}
- **App Store Connect**: https://appstoreconnect.apple.com/apps/6762031793/testflight/ios
- **Status**: Submitted to TestFlight
LOGEOF

echo "▸ Logged submission to docs/app-store-submissions.md (commit ${COMMIT_HASH})"

# Prevent accidental double-submission on re-run
mv "$BUILD_INFO_FILE" "${BUILD_INFO_FILE}.submitted.$(date +%Y%m%d%H%M%S)"

echo ""
echo "=== Done ==="
echo "TestFlight build will be available in ~5-10 minutes after Apple processing."
echo "Check: https://appstoreconnect.apple.com/apps/6762031793/testflight/ios"
