

# Skin Progress Graph

## Overview
Add a new "Skin Progress" line chart component placed just above the "What's Helping" section on the Insights page. It will plot the user's `skinFeeling` score (1-5) over time, with a time range toggle (7 days / 30 days / All time) and horizontal scrolling for large datasets.

## Data Source
- Uses `skinFeeling` from each `CheckIn` (values 1-5, where 1 = worst, 5 = best)
- Groups by date, averaging multiple check-ins per day
- Includes flare period shading (same pattern as Mood/Sleep/Pain trends)

## UI Design
- Glass card matching existing insight cards
- Icon: a line chart or trending-up icon in a green/primary tinted badge
- Time range toggle buttons: "Last 7 days", "Last 30 days", "All time" (same style as Symptoms component)
- Recharts `LineChart` with:
  - Y-axis: 1-5 with skin emoji labels (matching the weekly overview emojis)
  - X-axis: dates with day numbers
  - Custom tooltip showing date and skin score
  - Flare period `ReferenceArea` shading
  - Horizontal scroll for "All time" when there are many data points
- Summary text below the chart (e.g., average trend direction)

## Files to Create/Modify

### New file: `src/components/SkinProgressInsights.tsx`
- New component following the same patterns as `MoodTrendsInsights` and `SymptomsInsights`
- Props: `checkIns: CheckIn[]`, `dailyFlareStates: DailyFlareState[]`
- Time range state with 7/30/all toggle
- Computes daily average `skinFeeling`, filters by time range
- Renders a scrollable Recharts `LineChart`
- Shows flare period shading via `ReferenceArea`
- Includes a brief summary (e.g., "Your skin has been improving over the last 7 days")

### Modified file: `src/pages/InsightsPage.tsx`
- Import `SkinProgressInsights`
- Place it in the premium section just before `WhatHelpedInsights` (line ~484)
- Also add a blurred/locked preview version in `LockedInsightsPreview` for non-premium users

### Modified file: `src/components/insights/LockedInsightsPreview.tsx`
- Add a "Skin Progress" card with an `AnimatingGraph` placeholder, placed before the "What's Helping" section

## Technical Details

```text
Premium section order (InsightsPage.tsx, line ~483):
  1. SkinProgressInsights    <-- NEW
  2. WhatHelpedInsights
  3. TriggerPatternsInsights
  4. SymptomsInsights
  5. MoodTrendsInsights
  6. SleepTrendsInsights
  7. PainTrendsInsights
```

The component will reuse:
- `recharts` (LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine)
- `date-fns` for date filtering and formatting
- `DailyFlareState` from `flareStateEngine` for flare shading
- The same time-range button pattern from `SymptomsInsights`
- The same scrollable container pattern from `SymptomsInsights` severity trends for "All time" view
