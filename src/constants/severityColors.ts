// Shared severity color mapping used across the app
// Mild = light yellow, Mod = orange, Severe = red

export const severityColors = {
  // Background colors for dots/indicators
  bg: {
    1: 'bg-[#22C55E]', // Mild - green
    2: 'bg-[#F59E0B]', // Mod - orange
    3: 'bg-[#EF4444]', // Severe - red
  },
  // Badge/pill styles with proper text contrast
  badge: {
    1: 'bg-[#22C55E] text-white dark:bg-[#22C55E] dark:text-white', // White text on green
    2: 'bg-[#F59E0B] text-white dark:bg-[#F59E0B] dark:text-white', // White text on orange
    3: 'bg-[#EF4444] text-white dark:bg-[#EF4444] dark:text-white', // White text on red
  },
  // Outline badge styles (for calendar history view)
  badgeOutline: {
    1: 'border-[#22C55E] text-green-700 bg-[#22C55E]/20 dark:bg-[#22C55E]/30 dark:text-[#22C55E]',
    2: 'border-[#F59E0B] text-orange-700 bg-[#F59E0B]/20 dark:bg-[#F59E0B]/30 dark:text-[#F59E0B]',
    3: 'border-[#EF4444] text-red-700 bg-[#EF4444]/20 dark:bg-[#EF4444]/30 dark:text-[#EF4444]',
  },
  // Unselected/preview states
  bgMuted: {
    1: 'bg-[#22C55E]/50', // Mild muted
    2: 'bg-[#F59E0B]/50', // Mod muted
    3: 'bg-[#EF4444]/50', // Severe muted
  },
  // Hex values for charts or dynamic styling
  hex: {
    1: '#22C55E', // Mild - green
    2: '#F59E0B', // Mod - orange
    3: '#EF4444', // Severe - red
  },
} as const;

export const severityLabels: Record<1 | 2 | 3, string> = {
  1: 'Mild',
  2: 'Mod',
  3: 'Severe',
};
