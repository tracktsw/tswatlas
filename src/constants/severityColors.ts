// Shared severity color mapping used across the app
// Mild = light yellow, Mod = orange, Severe = red

export const severityColors = {
  // Background colors for dots/indicators
  bg: {
    1: 'bg-[#FDE68A]', // Mild - light yellow
    2: 'bg-[#F59E0B]', // Mod - orange
    3: 'bg-[#EF4444]', // Severe - red
  },
  // Badge/pill styles with proper text contrast
  badge: {
    1: 'bg-[#FDE68A] text-amber-900 dark:bg-[#FDE68A]/90 dark:text-amber-900', // Dark text on light yellow
    2: 'bg-[#F59E0B] text-white dark:bg-[#F59E0B] dark:text-white', // White text on orange
    3: 'bg-[#EF4444] text-white dark:bg-[#EF4444] dark:text-white', // White text on red
  },
  // Outline badge styles (for calendar history view)
  badgeOutline: {
    1: 'border-[#FDE68A] text-amber-700 bg-[#FDE68A]/20 dark:bg-[#FDE68A]/30 dark:text-[#FDE68A]',
    2: 'border-[#F59E0B] text-orange-700 bg-[#F59E0B]/20 dark:bg-[#F59E0B]/30 dark:text-[#F59E0B]',
    3: 'border-[#EF4444] text-red-700 bg-[#EF4444]/20 dark:bg-[#EF4444]/30 dark:text-[#EF4444]',
  },
  // Unselected/preview states
  bgMuted: {
    1: 'bg-[#FDE68A]/50', // Mild muted
    2: 'bg-[#F59E0B]/50', // Mod muted
    3: 'bg-[#EF4444]/50', // Severe muted
  },
  // Hex values for charts or dynamic styling
  hex: {
    1: '#FDE68A', // Mild - light yellow
    2: '#F59E0B', // Mod - orange
    3: '#EF4444', // Severe - red
  },
} as const;

export const severityLabels: Record<1 | 2 | 3, string> = {
  1: 'Mild',
  2: 'Mod',
  3: 'Severe',
};
