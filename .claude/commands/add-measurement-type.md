---
description: Add a new measurement type to the generic measurements table
---

The user wants to add a new measurement type (e.g., temperature, heart rate, hydration score). The measurements table is intentionally generic (`type`, `value`, `unit`) so no schema changes are needed — but several shared files must be updated.

## Steps

1. **Add the type to `VALID_MEASUREMENT_TYPES`** in `shared/lib/constants.ts`.

2. **Add a label in `MEASUREMENT_TYPE_LABELS`** (and `MEASUREMENT_TYPE_LABELS_LONG` if a longer form is needed).

3. **If behavioral (0-3 scale), add to `BEHAVIORAL_TYPES`** array in `shared/lib/constants.ts`.

4. **If it uses a 0-3 scale, add presets in `shared/lib/measurementPresets.ts`.**

5. **If the visualization differs from existing charts**, add a chart component in `frontend/src/components/`. For native, check whether `app/components/LineChart.tsx` handles the new type via existing props.

6. **Validate on both platforms:**
   - Web: check `frontend/src/pages/CatProfile.tsx` renders the new type
   - Native: check `app/app/cats/[id]/index.tsx` renders the new type

7. **No DB schema changes.** The `measurements` table's generic shape (`type`, `value`, `unit`) means both platforms pick up the new type automatically via the shared constants.

8. **Update `VALID_UNITS`** in `worker/src/routes/measurements.ts` if the new type requires a unit not already in the list (`['lbs', 'kg', 'scale']`).

9. **Add tests:**
   - `shared/__tests__/constants.test.ts` — verify the new type is included
   - `worker/src/__tests__/routes/measurements.test.ts` — verify the API accepts measurements of the new type

10. **Deploy:** Worker (if `VALID_UNITS` changed), then frontend, then test iOS app.

## Reference

- Schema: `worker/src/db/schema.sql` (measurements table)
- API spec: `docs/API.md` (measurements endpoints)
- Cross-platform file mapping: `CLAUDE.md` § "Cross-platform file mapping"
