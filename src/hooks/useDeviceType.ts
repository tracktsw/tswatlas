import { useState, useEffect } from 'react';

type DeviceType = 'phone' | 'tablet' | 'desktop';

interface DeviceTypeResult {
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  deviceType: DeviceType;
}

const PHONE_MAX = 768;
const TABLET_MAX = 1024;

export const useDeviceType = (): DeviceTypeResult => {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    if (typeof window === 'undefined') return 'phone';
    const width = window.innerWidth;
    if (width < PHONE_MAX) return 'phone';
    if (width < TABLET_MAX) return 'tablet';
    return 'desktop';
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < PHONE_MAX) {
        setDeviceType('phone');
      } else if (width < TABLET_MAX) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    isPhone: deviceType === 'phone',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
    deviceType,
  };
};
