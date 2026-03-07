# PRD: Health Status Visuals — Emoji Indicators

**Status:** Approved for implementation
**Scope:** Replace colored dots on charts and legend with emoji indicators

---

## Problem

Colored dots (green/yellow/orange/red) require the user to remember a color legend to interpret them. Color alone is also inaccessible for color-blind users. A glanceable symbol communicates meaning without reference.

## Proposal

Replace the colored `<circle>` data point dots on charts with emoji rendered as SVG `<text>` nodes. Use the same emoji in the legend.

### Status → Emoji mapping

| Status | Emoji | Rationale |
|--------|-------|-----------|
| ok | ✅ | Universal "all good" |
| watch | 👀 | "Keep an eye on this" — intuitive |
| concerning | ⚠️ | Standard warning symbol |
| urgent | 🚨 | Emergency / act now |

### Where applied

- `WeightChart.tsx` — data point dots
- `CompareChart.tsx` — data point dots + legend row
- `CatProfile.tsx` status badge chips — add emoji prefix

### Implementation notes

- SVG emoji text: `<text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={14}>{emoji}</text>`
- Remove the glow circle behind the dot (emoji has enough visual weight)
- Keep the `activeDot` on hover as a plain colored circle (Recharts built-in)
- Export `STATUS_EMOJI: Record<HealthStatus, string>` from `healthMetrics.ts`
- Legend: replace `<span className="w-1.5 h-1.5 rounded-full" />` with the emoji character

## Out of Scope

- Emoji in notification push text (no push yet)
- Changing the colored border/background on cat cards (those are intentional severity signals, not dots)
