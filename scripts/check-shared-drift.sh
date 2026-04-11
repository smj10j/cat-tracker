#!/bin/bash
set -euo pipefail

# Check that shared libs in frontend/ and app/ are re-exports, not local copies.
# Run this before any commit that touches lib files.

cd "$(dirname "$0")/.."
DRIFT=0

echo "Checking for shared lib drift..."

for f in correlations.ts healthMetrics.ts measurementPresets.ts dates.ts; do
  for dir in frontend/src/lib app/lib; do
    FILE="$dir/$f"
    if [ -f "$FILE" ]; then
      if ! grep -q "@shared/lib/" "$FILE" 2>/dev/null; then
        echo "  DRIFT: $FILE is not a re-export from @shared/lib/"
        DRIFT=1
      fi
    fi
  done
done

# Check that shared/lib/ files don't import from ./api (should use ./types)
for f in shared/lib/correlations.ts shared/lib/healthMetrics.ts; do
  if grep -q "from './api'" "$f" 2>/dev/null; then
    echo "  DRIFT: $f imports from ./api instead of ./types"
    DRIFT=1
  fi
done

if [ "$DRIFT" -eq 0 ]; then
  echo "  No drift detected. Shared libs are properly linked."
else
  echo ""
  echo "  Fix: Replace local lib content with 're-export from @shared/lib/<name>'"
  exit 1
fi
