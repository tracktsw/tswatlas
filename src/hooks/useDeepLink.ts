import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

export const useDeepLink = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only set up deep link handling on native platforms
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const handleDeepLink = (event: { url: string }) => {
      console.log('[DeepLink] Received URL:', event.url);
      
      try {
        // Handle tracktsw:// scheme
        // URL format from Supabase verify: tracktsw://reset-password#access_token=xxx&refresh_token=xxx&type=recovery
        // Or with query params: tracktsw://reset-password?access_token=xxx&refresh_token=xxx&type=recovery
        const url = new URL(event.url);
        
        // Check for reset-password path (host in custom schemes)
        const isResetPassword = url.host === 'reset-password' || 
                                url.pathname === '/reset-password' ||
                                url.pathname === 'reset-password';
        
        if (isResetPassword) {
          // Extract tokens from either hash or search params
          const hashParams = url.hash ? new URLSearchParams(url.hash.substring(1)) : new URLSearchParams();
          const searchParams = url.searchParams;
          
          const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
          const type = hashParams.get('type') || searchParams.get('type');
          
          console.log('[DeepLink] Password reset deep link detected', { 
            hasAccessToken: !!accessToken, 
            hasRefreshToken: !!refreshToken, 
            type 
          });
          
          if (accessToken && refreshToken && type === 'recovery') {
            // Store tokens in sessionStorage for the reset page to use
            sessionStorage.setItem('resetTokens', JSON.stringify({
              access_token: accessToken,
              refresh_token: refreshToken,
              type: type
            }));
            
            console.log('[DeepLink] Navigating to /reset-password');
            navigate('/reset-password');
          } else {
            console.log('[DeepLink] Missing required tokens, navigating with error state');
            navigate('/reset-password?error=invalid_link');
          }
        }
      } catch (error) {
        console.error('[DeepLink] Error parsing deep link URL:', error);
      }
    };

    // Listen for app URL open events
    CapacitorApp.addListener('appUrlOpen', handleDeepLink);

    // Also check if app was opened via deep link (cold start)
    CapacitorApp.getLaunchUrl().then((result) => {
      if (result?.url) {
        console.log('[DeepLink] App launched with URL:', result.url);
        handleDeepLink({ url: result.url });
      }
    });

    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, [navigate, location]);
};
