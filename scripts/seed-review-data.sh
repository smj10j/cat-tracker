#!/bin/bash
# Seed realistic test data for the Apple review account.
# Run once. Safe to re-run (creates new cats each time though).

set -euo pipefail

API="https://cat-tracker-api.stevej-67b.workers.dev"
TOKEN="c360ab88b6cb403abeb52e1d480f3d9c"
AUTH="Authorization: Bearer $TOKEN"
CT="Content-Type: application/json"

# Existing cat
BISCUIT_ID="6f4a3f1aaf296933"

# ── Create Cat 2: Mochi ──────────────────────────────────────────────
echo "Creating Mochi..."
MOCHI_ID=$(curl -s -X POST "$API/api/cats" \
  -H "$AUTH" -H "$CT" \
  -d '{"name":"Mochi","birthdate":"2023-04-12","breed":"Scottish Fold","coloring":"Cream and white","sex":"Female","is_neutered":1,"notes":"Loves to sit in boxes. Very food motivated."}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  Mochi ID: $MOCHI_ID"

# ── Create Cat 3: Oscar ──────────────────────────────────────────────
echo "Creating Oscar..."
OSCAR_ID=$(curl -s -X POST "$API/api/cats" \
  -H "$AUTH" -H "$CT" \
  -d '{"name":"Oscar","birthdate":"2019-08-20","breed":"Maine Coon mix","coloring":"Brown tabby","sex":"Male","is_neutered":1,"notes":"Senior boy, gentle giant. Indoor only."}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  Oscar ID: $OSCAR_ID"

# ── Helper: post a measurement ────────────────────────────────────────
post() {
  local cat_id=$1 type=$2 value=$3 unit=$4 date=$5
  curl -s -X POST "$API/api/cats/$cat_id/measurements" \
    -H "$AUTH" -H "$CT" \
    -d "{\"type\":\"$type\",\"value\":$value,\"unit\":\"$unit\",\"measured_at\":\"${date}T12:00:00Z\",\"notes\":null}" \
    > /dev/null
}

# ======================================================================
# BISCUIT — young male, ~4.5 yrs old, Raganese
#   Weight: religious weekly tracker for 2 months, then a 3-week gap,
#           then resumes. Slight upward trend (gaining a little).
#   Behavioral: logged every few days, some gaps
# ======================================================================
echo "Seeding Biscuit data..."

# Weight — weekly from mid-Jan, gap in March, resumes late March
post $BISCUIT_ID weight 10.1 lbs 2026-01-13
post $BISCUIT_ID weight 10.2 lbs 2026-01-20
post $BISCUIT_ID weight 10.1 lbs 2026-01-27
post $BISCUIT_ID weight 10.3 lbs 2026-02-03
post $BISCUIT_ID weight 10.2 lbs 2026-02-10
post $BISCUIT_ID weight 10.4 lbs 2026-02-17
post $BISCUIT_ID weight 10.3 lbs 2026-02-24
post $BISCUIT_ID weight 10.5 lbs 2026-03-03
# gap — owner was traveling
post $BISCUIT_ID weight 10.6 lbs 2026-03-24
post $BISCUIT_ID weight 10.5 lbs 2026-03-31
post $BISCUIT_ID weight 10.7 lbs 2026-04-07

# Behavioral — food (every few days, normal appetite)
post $BISCUIT_ID food 2 scale 2026-01-13
post $BISCUIT_ID food 2 scale 2026-01-16
post $BISCUIT_ID food 2 scale 2026-01-20
post $BISCUIT_ID food 3 scale 2026-01-24
post $BISCUIT_ID food 2 scale 2026-01-27
post $BISCUIT_ID food 2 scale 2026-02-01
post $BISCUIT_ID food 2 scale 2026-02-05
post $BISCUIT_ID food 2 scale 2026-02-10
post $BISCUIT_ID food 2 scale 2026-02-14
post $BISCUIT_ID food 2 scale 2026-02-17
post $BISCUIT_ID food 3 scale 2026-02-22
post $BISCUIT_ID food 2 scale 2026-02-26
post $BISCUIT_ID food 2 scale 2026-03-24
post $BISCUIT_ID food 2 scale 2026-03-28
post $BISCUIT_ID food 2 scale 2026-04-01
post $BISCUIT_ID food 2 scale 2026-04-07

# Water — sporadic, every week or so
post $BISCUIT_ID water 2 scale 2026-01-13
post $BISCUIT_ID water 2 scale 2026-01-20
post $BISCUIT_ID water 2 scale 2026-02-03
post $BISCUIT_ID water 2 scale 2026-02-17
post $BISCUIT_ID water 2 scale 2026-03-03
post $BISCUIT_ID water 2 scale 2026-03-24
post $BISCUIT_ID water 2 scale 2026-04-07

# Litter — logged with food most times
post $BISCUIT_ID litter 2 scale 2026-01-13
post $BISCUIT_ID litter 2 scale 2026-01-16
post $BISCUIT_ID litter 2 scale 2026-01-20
post $BISCUIT_ID litter 2 scale 2026-01-27
post $BISCUIT_ID litter 2 scale 2026-02-05
post $BISCUIT_ID litter 2 scale 2026-02-14
post $BISCUIT_ID litter 2 scale 2026-02-22
post $BISCUIT_ID litter 2 scale 2026-03-24
post $BISCUIT_ID litter 2 scale 2026-04-01

# Activity — occasional
post $BISCUIT_ID activity 2 scale 2026-01-13
post $BISCUIT_ID activity 3 scale 2026-01-24
post $BISCUIT_ID activity 2 scale 2026-02-10
post $BISCUIT_ID activity 2 scale 2026-02-26
post $BISCUIT_ID activity 2 scale 2026-03-24
post $BISCUIT_ID activity 2 scale 2026-04-07

# Grooming — very sporadic
post $BISCUIT_ID grooming 2 scale 2026-01-20
post $BISCUIT_ID grooming 2 scale 2026-02-17
post $BISCUIT_ID grooming 2 scale 2026-03-31

# Vomiting — one incident
post $BISCUIT_ID vomiting 1 scale 2026-02-08

echo "  Biscuit: done"

# ======================================================================
# MOCHI — young female, ~3 yrs, Scottish Fold
#   Weight: very diligent weekly, stable around 8.2 lbs
#   Behavioral: most thorough logger — records almost everything
# ======================================================================
echo "Seeding Mochi data..."

# Weight — very consistent weekly
post $MOCHI_ID weight 8.0 lbs 2026-01-06
post $MOCHI_ID weight 8.1 lbs 2026-01-13
post $MOCHI_ID weight 8.0 lbs 2026-01-20
post $MOCHI_ID weight 8.2 lbs 2026-01-27
post $MOCHI_ID weight 8.1 lbs 2026-02-03
post $MOCHI_ID weight 8.2 lbs 2026-02-10
post $MOCHI_ID weight 8.3 lbs 2026-02-17
post $MOCHI_ID weight 8.2 lbs 2026-02-24
post $MOCHI_ID weight 8.3 lbs 2026-03-03
post $MOCHI_ID weight 8.2 lbs 2026-03-10
post $MOCHI_ID weight 8.3 lbs 2026-03-17
post $MOCHI_ID weight 8.2 lbs 2026-03-24
post $MOCHI_ID weight 8.3 lbs 2026-03-31
post $MOCHI_ID weight 8.2 lbs 2026-04-07

# Food — logged almost every check-in, always hungry
post $MOCHI_ID food 3 scale 2026-01-06
post $MOCHI_ID food 2 scale 2026-01-09
post $MOCHI_ID food 3 scale 2026-01-13
post $MOCHI_ID food 2 scale 2026-01-16
post $MOCHI_ID food 3 scale 2026-01-20
post $MOCHI_ID food 2 scale 2026-01-23
post $MOCHI_ID food 3 scale 2026-01-27
post $MOCHI_ID food 2 scale 2026-01-30
post $MOCHI_ID food 2 scale 2026-02-03
post $MOCHI_ID food 3 scale 2026-02-06
post $MOCHI_ID food 2 scale 2026-02-10
post $MOCHI_ID food 3 scale 2026-02-13
post $MOCHI_ID food 2 scale 2026-02-17
post $MOCHI_ID food 3 scale 2026-02-20
post $MOCHI_ID food 2 scale 2026-02-24
post $MOCHI_ID food 2 scale 2026-02-27
post $MOCHI_ID food 3 scale 2026-03-03
post $MOCHI_ID food 2 scale 2026-03-06
post $MOCHI_ID food 2 scale 2026-03-10
post $MOCHI_ID food 3 scale 2026-03-13
post $MOCHI_ID food 2 scale 2026-03-17
post $MOCHI_ID food 2 scale 2026-03-20
post $MOCHI_ID food 3 scale 2026-03-24
post $MOCHI_ID food 2 scale 2026-03-27
post $MOCHI_ID food 2 scale 2026-03-31
post $MOCHI_ID food 3 scale 2026-04-03
post $MOCHI_ID food 2 scale 2026-04-07

# Water — every check-in
post $MOCHI_ID water 2 scale 2026-01-06
post $MOCHI_ID water 2 scale 2026-01-13
post $MOCHI_ID water 2 scale 2026-01-20
post $MOCHI_ID water 2 scale 2026-01-27
post $MOCHI_ID water 2 scale 2026-02-03
post $MOCHI_ID water 2 scale 2026-02-10
post $MOCHI_ID water 3 scale 2026-02-17
post $MOCHI_ID water 2 scale 2026-02-24
post $MOCHI_ID water 2 scale 2026-03-03
post $MOCHI_ID water 2 scale 2026-03-10
post $MOCHI_ID water 2 scale 2026-03-17
post $MOCHI_ID water 2 scale 2026-03-24
post $MOCHI_ID water 2 scale 2026-03-31
post $MOCHI_ID water 2 scale 2026-04-07

# Litter — same cadence
post $MOCHI_ID litter 2 scale 2026-01-06
post $MOCHI_ID litter 2 scale 2026-01-13
post $MOCHI_ID litter 2 scale 2026-01-20
post $MOCHI_ID litter 2 scale 2026-01-27
post $MOCHI_ID litter 2 scale 2026-02-03
post $MOCHI_ID litter 2 scale 2026-02-10
post $MOCHI_ID litter 2 scale 2026-02-17
post $MOCHI_ID litter 2 scale 2026-02-24
post $MOCHI_ID litter 2 scale 2026-03-03
post $MOCHI_ID litter 2 scale 2026-03-10
post $MOCHI_ID litter 2 scale 2026-03-17
post $MOCHI_ID litter 2 scale 2026-03-24
post $MOCHI_ID litter 2 scale 2026-03-31
post $MOCHI_ID litter 2 scale 2026-04-07

# Activity — generally active, some lazy days
post $MOCHI_ID activity 3 scale 2026-01-06
post $MOCHI_ID activity 2 scale 2026-01-13
post $MOCHI_ID activity 3 scale 2026-01-20
post $MOCHI_ID activity 2 scale 2026-01-27
post $MOCHI_ID activity 2 scale 2026-02-03
post $MOCHI_ID activity 3 scale 2026-02-10
post $MOCHI_ID activity 2 scale 2026-02-17
post $MOCHI_ID activity 2 scale 2026-02-24
post $MOCHI_ID activity 3 scale 2026-03-03
post $MOCHI_ID activity 2 scale 2026-03-10
post $MOCHI_ID activity 2 scale 2026-03-17
post $MOCHI_ID activity 3 scale 2026-03-24
post $MOCHI_ID activity 2 scale 2026-03-31
post $MOCHI_ID activity 2 scale 2026-04-07

# Grooming — weekly
post $MOCHI_ID grooming 2 scale 2026-01-06
post $MOCHI_ID grooming 2 scale 2026-01-20
post $MOCHI_ID grooming 2 scale 2026-02-03
post $MOCHI_ID grooming 2 scale 2026-02-17
post $MOCHI_ID grooming 2 scale 2026-03-03
post $MOCHI_ID grooming 2 scale 2026-03-17
post $MOCHI_ID grooming 2 scale 2026-03-31

# Vomiting — none (healthy cat)

echo "  Mochi: done"

# ======================================================================
# OSCAR — older male, ~6.5 yrs, Maine Coon mix
#   Weight: irregular — monthly-ish, slight downward trend (vet flag)
#   Behavioral: sparse, big gaps, forgetful owner pattern
# ======================================================================
echo "Seeding Oscar data..."

# Weight — monthly-ish, gradual decline (13.5 -> 12.6 over 3 months)
post $OSCAR_ID weight 13.5 lbs 2026-01-05
post $OSCAR_ID weight 13.4 lbs 2026-01-19
post $OSCAR_ID weight 13.2 lbs 2026-02-08
post $OSCAR_ID weight 13.1 lbs 2026-02-22
post $OSCAR_ID weight 12.9 lbs 2026-03-15
post $OSCAR_ID weight 12.8 lbs 2026-03-29
post $OSCAR_ID weight 12.6 lbs 2026-04-10

# Food — sparse, big gaps, sometimes reduced
post $OSCAR_ID food 2 scale 2026-01-05
post $OSCAR_ID food 2 scale 2026-01-19
post $OSCAR_ID food 2 scale 2026-02-08
post $OSCAR_ID food 1 scale 2026-02-22
post $OSCAR_ID food 1 scale 2026-03-15
post $OSCAR_ID food 2 scale 2026-03-29
post $OSCAR_ID food 1 scale 2026-04-10

# Water — occasional, sometimes increased (compensating?)
post $OSCAR_ID water 2 scale 2026-01-05
post $OSCAR_ID water 2 scale 2026-02-08
post $OSCAR_ID water 3 scale 2026-03-15
post $OSCAR_ID water 3 scale 2026-04-10

# Litter — very sporadic
post $OSCAR_ID litter 2 scale 2026-01-05
post $OSCAR_ID litter 2 scale 2026-02-08
post $OSCAR_ID litter 2 scale 2026-03-29

# Activity — declining
post $OSCAR_ID activity 2 scale 2026-01-05
post $OSCAR_ID activity 2 scale 2026-01-19
post $OSCAR_ID activity 1 scale 2026-02-22
post $OSCAR_ID activity 1 scale 2026-03-15
post $OSCAR_ID activity 1 scale 2026-04-10

# Grooming — one entry
post $OSCAR_ID grooming 2 scale 2026-02-08

# Vomiting — couple of incidents
post $OSCAR_ID vomiting 1 scale 2026-03-10
post $OSCAR_ID vomiting 1 scale 2026-03-28

echo "  Oscar: done"

# ── Create Cat 4: Pepper ─────────────────────────────────────────────
echo "Creating Pepper..."
PEPPER_ID=$(curl -s -X POST "$API/api/cats" \
  -H "$AUTH" -H "$CT" \
  -d '{"name":"Pepper","birthdate":"2022-06-15","breed":"Domestic Shorthair","coloring":"Black","sex":"Female","is_neutered":1,"notes":"Tiny and fearless. Loves high places."}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  Pepper ID: $PEPPER_ID"

# ======================================================================
# PEPPER — small female, ~4 yrs, DSH
#   Weight: started tracking recently (last 6 weeks), biweekly, stable ~7 lbs
#   Behavioral: enthusiastic for 2 weeks then fell off, then started again
# ======================================================================
echo "Seeding Pepper data..."

# Weight — started recently, biweekly
post $PEPPER_ID weight 7.1 lbs 2026-02-24
post $PEPPER_ID weight 7.0 lbs 2026-03-10
post $PEPPER_ID weight 7.1 lbs 2026-03-24
post $PEPPER_ID weight 7.0 lbs 2026-04-07

# Food — enthusiastic first 2 weeks, gap, then resumed
post $PEPPER_ID food 2 scale 2026-02-24
post $PEPPER_ID food 2 scale 2026-02-25
post $PEPPER_ID food 2 scale 2026-02-26
post $PEPPER_ID food 2 scale 2026-02-27
post $PEPPER_ID food 3 scale 2026-02-28
post $PEPPER_ID food 2 scale 2026-03-01
post $PEPPER_ID food 2 scale 2026-03-02
post $PEPPER_ID food 2 scale 2026-03-03
post $PEPPER_ID food 2 scale 2026-03-04
post $PEPPER_ID food 3 scale 2026-03-05
# gap — stopped logging for 3 weeks
post $PEPPER_ID food 2 scale 2026-03-27
post $PEPPER_ID food 2 scale 2026-03-31
post $PEPPER_ID food 2 scale 2026-04-04
post $PEPPER_ID food 2 scale 2026-04-07

# Water — same pattern
post $PEPPER_ID water 2 scale 2026-02-24
post $PEPPER_ID water 2 scale 2026-02-26
post $PEPPER_ID water 2 scale 2026-02-28
post $PEPPER_ID water 2 scale 2026-03-01
post $PEPPER_ID water 2 scale 2026-03-04
post $PEPPER_ID water 2 scale 2026-03-31
post $PEPPER_ID water 2 scale 2026-04-07

# Activity — very active
post $PEPPER_ID activity 3 scale 2026-02-24
post $PEPPER_ID activity 3 scale 2026-02-28
post $PEPPER_ID activity 3 scale 2026-03-04
post $PEPPER_ID activity 3 scale 2026-03-31
post $PEPPER_ID activity 2 scale 2026-04-07

# Litter — occasional
post $PEPPER_ID litter 2 scale 2026-02-24
post $PEPPER_ID litter 2 scale 2026-03-04
post $PEPPER_ID litter 2 scale 2026-04-07

# Grooming — once
post $PEPPER_ID grooming 2 scale 2026-03-01

echo "  Pepper: done"

echo ""
echo "Seeding complete!"
echo "  Biscuit (existing): $BISCUIT_ID"
echo "  Mochi (new):       $MOCHI_ID"
echo "  Oscar (new):       $OSCAR_ID"
echo "  Pepper (new):      $PEPPER_ID"
