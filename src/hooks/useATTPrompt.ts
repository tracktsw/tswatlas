import { useCallback, useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface ATTPlugin {
  requestTracking(): Promise<{ status: string }>;
  getStatus(): Promise<{ status: string }>;
}

const ATT = registerPlugin<ATTPlugin>('ATT');

export type ATTStatus = 'authorized' | 'denied' | 'restricted' | 'notDetermined' | 'unknown' | 'unavailable';

export const useATTPrompt = () => {
  const [status, setStatus] = useState<ATTStatus>('notDetermined');
  const [hasRequested, setHasRequested] = useState(false);

  const isIOSNative = Capacitor.getPlatform() === 'ios';

  // Check current status on mount
  useEffect(() => {
    const checkStatus = async () => {
      if (!isIOSNative) {
        setStatus('unavailable');
        return;
      }

      try {
        const result = await ATT.getStatus();
        setStatus(result.status as ATTStatus);
        if (result.status !== 'notDetermined') {
          setHasRequested(true);
        }
      } catch (error) {
        console.log('[ATT] Failed to get status:', error);
        setStatus('unavailable');
      }
    };

    checkStatus();
  }, [isIOSNative]);

  const requestTracking = useCallback(async (): Promise<ATTStatus> => {
    if (!isIOSNative) {
      console.log('[ATT] Not on iOS native, skipping ATT request');
      return 'unavailable';
    }

    if (hasRequested) {
      console.log('[ATT] Already requested, returning current status:', status);
      return status;
    }

    try {
      console.log('[ATT] Requesting tracking authorization...');
      const result = await ATT.requestTracking();
      const newStatus = result.status as ATTStatus;
      console.log('[ATT] Authorization result:', newStatus);
      setStatus(newStatus);
      setHasRequested(true);
      return newStatus;
    } catch (error) {
      console.error('[ATT] Failed to request tracking:', error);
      return 'unknown';
    }
  }, [isIOSNative, hasRequested, status]);

  return {
    status,
    hasRequested,
    requestTracking,
    isAvailable: isIOSNative,
  };
};
