import { Capacitor } from '@capacitor/core';

// Simple haptic feedback hook that works with or without the Haptics plugin
export const useHapticFeedback = () => {
  const isNative = Capacitor.isNativePlatform();

  const impact = async (style: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!isNative) return;
    
    try {
      // Dynamically import Haptics only on native platforms
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      const styleMap = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      };
      await Haptics.impact({ style: styleMap[style] });
    } catch {
      // Haptics plugin not available, fail silently
    }
  };

  const notification = async (type: 'success' | 'warning' | 'error' = 'success') => {
    if (!isNative) return;
    
    try {
      const { Haptics, NotificationType } = await import('@capacitor/haptics');
      const typeMap = {
        success: NotificationType.Success,
        warning: NotificationType.Warning,
        error: NotificationType.Error,
      };
      await Haptics.notification({ type: typeMap[type] });
    } catch {
      // Haptics plugin not available, fail silently
    }
  };

  const selectionChanged = async () => {
    if (!isNative) return;
    
    try {
      const { Haptics } = await import('@capacitor/haptics');
      await Haptics.selectionChanged();
    } catch {
      // Haptics plugin not available, fail silently
    }
  };

  return {
    impact,
    notification,
    selectionChanged,
    isNative,
  };
};
