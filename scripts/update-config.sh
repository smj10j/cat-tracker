#!/usr/bin/env bash
# update-config.sh — Safely update the app config in Cloudflare KV
#
# Usage:
#   ./scripts/update-config.sh                  # Show current config
#   ./scripts/update-config.sh config.json      # Preview diff and apply
#   ./scripts/update-config.sh config.json --dry # Preview only, don't apply
#
# The config JSON must have at minimum: minSupportedVersion, latestVersion, features.
# Threshold values are validated: urgent > concerning > watch > 0.

set -euo pipefail

KV_NAMESPACE_ID="7fc5a67f7e774458a99bf41dc7fe761c"
ACCOUNT_ID="67ba5425d0189fa7d4cf1ada3239e058"
KEY="app_config"

# Show current config if no args
if [ $# -eq 0 ]; then
  echo "Current config in KV:"
  npx wrangler kv key get --namespace-id "$KV_NAMESPACE_ID" "$KEY" 2>/dev/null | jq . || echo "(empty or not set)"
  exit 0
fi

CONFIG_FILE="$1"
DRY_RUN="${2:-}"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: File not found: $CONFIG_FILE"
  exit 1
fi

# Validate JSON
if ! jq empty "$CONFIG_FILE" 2>/dev/null; then
  echo "Error: Invalid JSON in $CONFIG_FILE"
  exit 1
fi

# Validate required fields
MIN_VER=$(jq -r '.minSupportedVersion // empty' "$CONFIG_FILE")
FEATURES=$(jq -r '.features // empty' "$CONFIG_FILE")
if [ -z "$MIN_VER" ] || [ -z "$FEATURES" ]; then
  echo "Error: Config must have minSupportedVersion and features"
  exit 1
fi

# Validate threshold ordering if present
THRESHOLDS=$(jq '.thresholds // null' "$CONFIG_FILE")
if [ "$THRESHOLDS" != "null" ]; then
  WL=$(jq '.thresholds.weightLoss // null' "$CONFIG_FILE")
  if [ "$WL" != "null" ]; then
    URGENT=$(jq '.thresholds.weightLoss.urgentPctPerWeek' "$CONFIG_FILE")
    CONCERN=$(jq '.thresholds.weightLoss.concerningPctPerWeek' "$CONFIG_FILE")
    WATCH=$(jq '.thresholds.weightLoss.watchPctPerWeek' "$CONFIG_FILE")
    if ! python3 -c "
u, c, w = $URGENT, $CONCERN, $WATCH
assert u > c > w > 0, f'Threshold ordering violated: urgent({u}) > concerning({c}) > watch({w}) > 0'
" 2>/dev/null; then
      echo "Error: Weight loss thresholds must satisfy urgent > concerning > watch > 0"
      echo "  Got: urgent=$URGENT, concerning=$CONCERN, watch=$WATCH"
      exit 1
    fi
  fi
fi

# Show diff
echo "=== New config ==="
jq . "$CONFIG_FILE"

echo ""
echo "=== Current config ==="
CURRENT=$(npx wrangler kv key get --namespace-id "$KV_NAMESPACE_ID" "$KEY" 2>/dev/null || echo "{}")
echo "$CURRENT" | jq . 2>/dev/null || echo "(empty)"

if [ "$DRY_RUN" = "--dry" ]; then
  echo ""
  echo "Dry run — no changes applied."
  exit 0
fi

echo ""
read -p "Apply this config? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

npx wrangler kv key put --namespace-id "$KV_NAMESPACE_ID" "$KEY" --path "$CONFIG_FILE"
echo "Config updated successfully."
