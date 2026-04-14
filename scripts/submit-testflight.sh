#!/bin/bash
set -euo pipefail

# Submit a previously-built Whisker Health IPA to TestFlight and log the submission.
#
# Usage: ./scripts/submit-testflight.sh [--local | --cloud] [--info-file PATH]
#
#   --local   Upload directly to App Store Connect via `xcrun altool` — DEFAULT.
#             No Expo queue; no EAS credits. Requires Xcode + the ASC API key
#             referenced in app/eas.json.
#   --cloud   Route through EAS Submit (`npx eas submit`). Uses Expo's queue.
#             Slower when the free-tier queue is backed up, but works from
#             machines without Xcode.
#
# Reads build metadata written by scripts/build-ios.sh (default: /tmp/whisker-build-info.env).
# After a successful submit, the info file is renamed with a `.submitted.*` suffix
# so re-running doesn't double-submit. On failure, the info file is preserved so
# the submit can be retried without rebuilding.

cd "$(dirname "$0")/.."
ROOT=$(pwd)

BUILD_INFO_FILE="${BUILD_INFO_FILE:-/tmp/whisker-build-info.env}"
SUBMIT_LOG="${SUBMIT_LOG:-/tmp/whisker-submit.log}"
SUBMIT_MODE="local"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local)     SUBMIT_MODE="local"; shift ;;
    --cloud)     SUBMIT_MODE="cloud"; shift ;;
    --info-file) BUILD_INFO_FILE="$2"; shift 2 ;;
    -h|--help)
      grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "✗ Unknown option: $1" >&2; echo "Usage: $0 [--local | --cloud] [--info-file PATH]" >&2; exit 2 ;;
  esac
done

fail() {
  echo "" >&2
  echo "✗ $*" >&2
  exit 1
}

echo "=== Whisker Health → TestFlight submit ==="
echo "Submit mode: $SUBMIT_MODE"
echo "Info file:   $BUILD_INFO_FILE"
echo "Submit log:  $SUBMIT_LOG"
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

echo "Build mode:  $BUILD_MODE"
echo "App version: $APP_VERSION"
echo "Commit:      $COMMIT_HASH ($COMMIT_HASH_FULL)"
echo "Commit msg:  $COMMIT_MSG"
echo ""

# --- Validate artifact availability for the chosen submit mode ---
if [ "$SUBMIT_MODE" = "local" ]; then
  [ -n "${IPA_PATH:-}" ] || fail "--local submit requires a local IPA, but IPA_PATH is empty in $BUILD_INFO_FILE.
Either rebuild locally (./scripts/build-ios.sh --local) or submit via --cloud."
  [ -f "$IPA_PATH" ] || fail "IPA not found at $IPA_PATH (was it moved or deleted?)"
  echo "▸ Will upload local IPA via xcrun altool: $IPA_PATH"
else
  case "$BUILD_MODE" in
    local) [ -f "${IPA_PATH:-/nonexistent}" ] || fail "IPA not found at ${IPA_PATH:-?}"
           echo "▸ Will submit local IPA via eas submit: $IPA_PATH" ;;
    cloud) [ -n "${IPA_URL:-}" ] || fail "Cloud build but IPA_URL is empty in $BUILD_INFO_FILE"
           echo "▸ Will submit cloud IPA via eas submit: $IPA_URL" ;;
    *)     fail "Unknown BUILD_MODE in info file: $BUILD_MODE" ;;
  esac
fi
echo ""

: > "$SUBMIT_LOG"

# ----- Local submit: xcrun altool directly to App Store Connect -----
do_local_submit() {
  local eas_json="$ROOT/app/eas.json"
  [ -f "$eas_json" ] || { echo "✗ $eas_json not found — need ASC API key config" >&2; return 1; }

  local key_id issuer_id key_path_rel key_path
  key_id=$(node -p "require('$eas_json').submit.production.ios.ascApiKeyId" 2>/dev/null || true)
  issuer_id=$(node -p "require('$eas_json').submit.production.ios.ascApiKeyIssuerId" 2>/dev/null || true)
  key_path_rel=$(node -p "require('$eas_json').submit.production.ios.ascApiKeyPath" 2>/dev/null || true)
  [ -n "$key_id" ]     || { echo "✗ ascApiKeyId missing from $eas_json" >&2; return 1; }
  [ -n "$issuer_id" ]  || { echo "✗ ascApiKeyIssuerId missing from $eas_json" >&2; return 1; }
  [ -n "$key_path_rel" ] || { echo "✗ ascApiKeyPath missing from $eas_json" >&2; return 1; }

  # ascApiKeyPath is relative to app/eas.json's directory
  if [[ "$key_path_rel" = /* ]]; then
    key_path="$key_path_rel"
  else
    key_path="$ROOT/app/$key_path_rel"
  fi
  [ -f "$key_path" ] || { echo "✗ ASC API key not found at $key_path" >&2; return 1; }

  # altool searches well-known locations for AuthKey_<KEY_ID>.p8 — stage it there.
  local apple_keys_dir="$HOME/.appstoreconnect/private_keys"
  local staged_key="$apple_keys_dir/AuthKey_${key_id}.p8"
  if [ ! -f "$staged_key" ]; then
    mkdir -p "$apple_keys_dir"
    cp "$key_path" "$staged_key"
    chmod 600 "$staged_key"
    echo "▸ Staged ASC API key at $staged_key"
  fi

  if ! command -v xcrun >/dev/null 2>&1; then
    echo "✗ xcrun not found — Xcode command line tools required for --local submit" >&2
    return 1
  fi

  echo "▸ Uploading to App Store Connect via xcrun altool..."
  echo "  Key ID:    $key_id"
  echo "  Issuer:    $issuer_id"
  echo "  IPA:       $IPA_PATH"
  echo ""

  set +e
  xcrun altool --upload-app --type ios --file "$IPA_PATH" \
    --apiKey "$key_id" --apiIssuer "$issuer_id" 2>&1 | tee "$SUBMIT_LOG"
  local status=${PIPESTATUS[0]}
  set -e

  if [ "$status" -ne 0 ]; then
    echo "" >&2
    echo "✗ xcrun altool exited with status $status" >&2
    echo "  Full log: $SUBMIT_LOG" >&2
    return 1
  fi

  # altool prints "No errors uploading '<path>'" on success.
  if ! grep -Eqi 'No errors uploading|UPLOAD SUCCEEDED|uploaded successfully' "$SUBMIT_LOG"; then
    echo "" >&2
    echo "✗ altool exited 0 but no success marker found in log." >&2
    echo "  Inspect: $SUBMIT_LOG" >&2
    return 1
  fi
  return 0
}

# ----- Cloud submit: eas submit -----
do_cloud_submit() {
  cd "$ROOT/app"
  set +e
  if [ -n "${IPA_PATH:-}" ] && [ -f "${IPA_PATH:-}" ]; then
    npx eas submit --platform ios --path "$IPA_PATH" --non-interactive 2>&1 | tee "$SUBMIT_LOG"
  else
    npx eas submit --platform ios --url "$IPA_URL" --non-interactive 2>&1 | tee "$SUBMIT_LOG"
  fi
  local status=${PIPESTATUS[0]}
  set -e
  cd "$ROOT"

  if [ "$status" -ne 0 ]; then
    echo "" >&2
    echo "✗ eas submit exited with status $status" >&2
    echo "  Full log: $SUBMIT_LOG" >&2
    return 1
  fi

  if ! grep -Eqi 'Submitted your app|submission was successfully|has been successfully submitted|Ready for App Store Connect' "$SUBMIT_LOG"; then
    echo "" >&2
    echo "✗ eas submit exited 0 but the log does not contain a success marker." >&2
    echo "  Inspect: $SUBMIT_LOG" >&2
    return 1
  fi
  return 0
}

# --- Dispatch ---
SUCCESS=0
if [ "$SUBMIT_MODE" = "local" ]; then
  do_local_submit && SUCCESS=1 || SUCCESS=0
else
  do_cloud_submit && SUCCESS=1 || SUCCESS=0
fi

if [ "$SUCCESS" -ne 1 ]; then
  echo "" >&2
  echo "  Build info preserved at: $BUILD_INFO_FILE" >&2
  echo "  Retry with: ./scripts/submit-testflight.sh --info-file $BUILD_INFO_FILE" >&2
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
- **Submitted**: ${SUBMIT_DATE} ${SUBMIT_TIME} (via ${SUBMIT_MODE})
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
