

# Fix Paywall Modal Overflow on Mobile

## Problem
The paywall modal content is taller than the screen, causing it to be cut off. The feature comparison table has many rows, and combined with the header, button, and footer text, it exceeds the viewport height.

## Solution
Make the `DialogContent` wrapper on the Insights page constrain the paywall to fit within the screen by adding a max height and making the inner content scrollable.

## Changes

### 1. `src/pages/InsightsPage.tsx` (line 499)
Update the `DialogContent` className to constrain max height to `90dvh` (90% of dynamic viewport height) and enable vertical scrolling:

```tsx
<DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto p-0 border-0 bg-transparent shadow-none [&>button]:z-50">
```

### 2. `src/components/PaywallGuard.tsx` (line 237)
Remove the vertical padding from the full paywall wrapper so it fits tighter inside the dialog, and make the inner card scrollable if needed:

- Change the outer wrapper from `py-8 px-4` to `py-4 px-4` to reduce wasted space
- Add `max-h-[85dvh] overflow-y-auto` to the inner card container so the feature table scrolls within bounds while the subscribe button stays visible

Alternatively (simpler approach): reduce cell padding in the comparison table from `p-2` to `p-1.5` and reduce text size to make everything fit. However, the scrollable approach is more robust across all screen sizes.

### Recommended approach
Combine both:
1. Add `max-h-[90dvh] overflow-y-auto` to the `DialogContent` in InsightsPage
2. Reduce outer padding in PaywallGuard from `py-8` to `py-4`
3. Make the feature table area scrollable with a sticky subscribe button at the bottom -- this way the CTA is always visible without scrolling

### Detailed implementation
- In `PaywallGuard.tsx`, restructure the full paywall layout so the subscribe button and footer are pinned at the bottom using `flex flex-col` with the table area in a scrollable middle section
- The header and CTA button remain fixed/visible; only the comparison table scrolls if the content overflows
- This ensures the user never has to scroll to find the subscribe button

