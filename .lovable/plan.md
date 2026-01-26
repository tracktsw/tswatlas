
# Food Breakdown Analysis Redesign

## Summary

This plan redesigns the Food Breakdown analysis to be biologically plausible, conservative, and safe. The current implementation uses same-day comparisons and percentage-based metrics that create misleading correlations. The new approach uses delayed reaction analysis (1-3 days), consistency-based patterns, and cautious language to protect users from over-restriction.

---

## Current Problems Identified

1. **Same-day comparison**: Current logic compares skin intensity on the exact day food was logged
2. **Global baseline**: Uses overall average skin intensity as comparator (invalid)
3. **No minimum threshold**: Shows foods with only 1-2 occurrences
4. **Percentage metrics**: Shows misleading `+45% worse` type labels
5. **Time filter ignored**: Food breakdown doesn't respect 7d/30d/All toggle
6. **Magnitude over consistency**: Ranks by how much worse, not how often worse
7. **No explicit confidence**: No indication of data reliability

---

## New Data Model

Replace the current `ItemBreakdown` interface:

```text
Current:
- name: string
- count: number
- avgIntensity: number
- percentWorse: number

New:
- name: string
- count: number (times logged)
- daysWorseAfter: number (1-3 day window)
- daysBetterAfter: number
- daysNeutralAfter: number
- pattern: 'often_worse' | 'often_better' | 'mixed' | 'no_pattern' | 'insufficient_data'
- consistency: number (0-1, how consistent the pattern is)
- confidence: 'low' | 'medium' | 'high'
```

---

## Implementation Steps

### Step 1: Create Delayed Reaction Analysis Logic

Build a new analysis function that:

1. For each food logged on day D, look at skin intensity on days D+1, D+2, D+3
2. Compare post-food days to a **local baseline** (nearby days without that food, within 7-day window)
3. Classify each exposure as "worse after", "better after", or "neutral"
4. Track consistency across all exposures

```text
Algorithm:
1. Get all check-ins sorted by date
2. Build date→intensity map for fast lookup
3. For each food:
   a. Find all days food was logged
   b. For each log day:
      - Get avg intensity of D+1, D+2, D+3 (if data exists)
      - Get local baseline: avg of non-food days in ±7 day window
      - Compare: worse if post-food > baseline + threshold
   c. Count worse/better/neutral outcomes
   d. Calculate consistency ratio
```

### Step 2: Implement Minimum Evidence Threshold

- Foods logged fewer than 3 times show: "Not enough data yet"
- No color coding, pattern labels, or rankings for low-data foods
- Group these separately at bottom with muted styling

### Step 3: Replace Percentage Metrics with Directional Patterns

Remove all `percentWorse` calculations. Use pattern labels instead:

| Pattern | Criteria |
|---------|----------|
| Often followed by worse symptoms | ≥60% of exposures showed worsening |
| Often followed by improvement | ≥60% of exposures showed improvement |
| Mixed pattern | Neither worse nor better dominant |
| No clear pattern | Data too inconsistent to draw conclusions |
| Not enough data | Fewer than 3 logs |

### Step 4: Respect Time Period Filter

The food analysis must use the same `timePeriod` state (week/month/all) already in the component:

- Filter check-ins to selected period before analysis
- Require local baselines within the same period
- Show message when period has insufficient food data

### Step 5: Implement Consistency-Based Ranking

Sort foods by **consistency × frequency**, not by magnitude:

```text
score = consistency * log(count + 1) * (pattern === 'often_worse' ? 1 : 0.5)
```

This ensures:
- A food that was worse 4/5 times ranks above one worse 1/1 time
- High-frequency foods with consistent patterns surface first
- Inconsistent patterns sink regardless of sample size

### Step 6: Add Explicit Confidence Indicators

Each food entry displays confidence based on:

| Count | Consistency | Confidence |
|-------|-------------|------------|
| 3-4   | any         | Low        |
| 5-7   | <0.6        | Low        |
| 5-7   | ≥0.6        | Medium     |
| 8+    | <0.6        | Medium     |
| 8+    | ≥0.6        | High       |

Visual treatment:
- **High**: Solid styling, full opacity
- **Medium**: Standard styling
- **Low**: Faded styling, explicit "preliminary" label

### Step 7: Update UI Language and Styling

**Replace current color coding:**

| Current | New |
|---------|-----|
| Red (+20% worse) | Amber with "Often worse after" |
| Amber (+1-20%) | Muted with "Mixed pattern" |
| Green (neutral/better) | Sage with "No concern" |

**New cautious labels:**
- "Often associated with worse symptoms 1-3 days later"
- "Mixed reactions observed"
- "No clear pattern detected"
- "Often associated with improvement"

**Footer text:**
- Replace: "Shows how skin intensity compared to your average on days with each food"
- With: "Patterns are observational, not proof of cause. Always consult a healthcare provider before making dietary changes."

---

## UI Wireframe

```text
┌─────────────────────────────────────────────────┐
│ 🍽️ Food Diary Analysis                    [7d ▼]│
├─────────────────────────────────────────────────┤
│                                                 │
│ ⚠️ Observations only - not medical advice      │
│                                                 │
│ ─────────────────────────────────────────────── │
│                                                 │
│ Dairy                                   6 logs  │
│ ┌───────────────────────────────────────────┐   │
│ │ Often followed by worse symptoms          │   │
│ │ 5 of 6 times → skin worsened 1-3 days     │   │
│ │ later                        [HIGH CONF]  │   │
│ └───────────────────────────────────────────┘   │
│                                                 │
│ Gluten                                  4 logs  │
│ ┌───────────────────────────────────────────┐   │
│ │ Mixed pattern                             │   │
│ │ 2 worse, 1 better, 1 neutral              │   │
│ │                            [PRELIMINARY]  │   │
│ └───────────────────────────────────────────┘   │
│                                                 │
│ ─────────────────────────────────────────────── │
│ Not enough data yet                             │
│                                                 │
│ Soy (2 logs) · Eggs (1 log)                    │
│                                                 │
│ ─────────────────────────────────────────────── │
│ ℹ️ Patterns based on symptoms 1-3 days after   │
│    eating. Correlation ≠ causation.            │
└─────────────────────────────────────────────────┘
```

---

## Files to Modify

### 1. `src/components/TriggerPatternsInsights.tsx`

- Replace `ItemBreakdown` interface with new structure
- Rewrite food analysis logic in `useMemo` block (lines 274-315)
- Update UI rendering (lines 516-576)
- Add time period filtering to food analysis
- Add confidence indicators and pattern labels

### 2. `supabase/functions/ai-coach/index.ts`

- Update food context to use new terminology
- Remove percentage-based language
- Use directional patterns in AI prompts

---

## Technical Details

### New Helper Functions

```text
function analyzeDelayedReaction(
  checkIns: CheckIn[],
  foodName: string,
  periodDays: number
): FoodAnalysisResult

function getLocalBaseline(
  dateMap: Map<string, number>,
  targetDate: Date,
  excludeFood: string
): number | null

function classifyExposure(
  postFoodIntensity: number,
  localBaseline: number,
  threshold: number = 0.3
): 'worse' | 'better' | 'neutral'

function calculatePattern(
  worseCount: number,
  betterCount: number,
  neutralCount: number,
  total: number
): PatternType
```

### Edge Cases

1. **No data 1-3 days after food log**: Skip that exposure (don't count)
2. **Food logged on consecutive days**: Use first day as exposure, others as post-exposure
3. **All days have food logged**: Cannot establish baseline - show "Unable to analyze"
4. **Period filter shows 0 foods**: Show empty state with suggestion to view "All time"

---

## Testing Considerations

- Foods with 1-2 logs → Show "Not enough data"
- Foods with 3+ logs but inconsistent → "Mixed pattern" or "No clear pattern"
- Foods with 3+ logs and consistent worsening → "Often followed by worse symptoms"
- Time filter changes should update food list appropriately
- Verify delayed analysis correctly skips same-day comparisons
