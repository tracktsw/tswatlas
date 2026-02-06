import { lazy, Suspense, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { UserDataProvider } from "@/contexts/UserDataContext";
import { LayoutProvider } from "@/contexts/LayoutContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { IOSKeyboardProvider } from "@/contexts/IOSKeyboardContext";
import { RevenueCatProvider } from "@/contexts/RevenueCatContext";
import AuthGuard from "@/components/AuthGuard";
import Layout from "@/components/Layout";
import AuthPage from "@/pages/AuthPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import NotFound from "@/pages/NotFound";
import { useDeepLink } from "@/hooks/useDeepLink";
import { SafeArea } from 'capacitor-plugin-safe-area';
import { Capacitor } from '@capacitor/core';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { getPlatformInfo } from '@/hooks/usePlatform';
import { KeyboardWarning } from '@/components/KeyboardWarning';
import {
  HomePageSkeleton,
  PhotoDiaryPageSkeleton,
  CheckInPageSkeleton,
  InsightsPageSkeleton,
  CommunityPageSkeleton,
  JournalPageSkeleton,
  CoachPageSkeleton,
  SettingsPageSkeleton,
  GenericPageSkeleton,
} from "@/components/skeletons/PageSkeletons";

// Lazy load onboarding
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"));

// Lazy load all page components for faster initial load
const HomePage = lazy(() => import("@/pages/HomePage"));
const PhotoDiaryPage = lazy(() => import("@/pages/PhotoDiaryPage"));
const CheckInPage = lazy(() => import("@/pages/CheckInPage"));
const InsightsPage = lazy(() => import("@/pages/InsightsPage"));
const CommunityPage = lazy(() => import("@/pages/CommunityPage"));
const ResourcesPage = lazy(() => import("@/pages/ResourcesPage"));
const ResourceDetailPage = lazy(() => import("@/pages/ResourceDetailPage"));
const JournalPage = lazy(() => import("@/pages/JournalPage"));
const CoachPage = lazy(() => import("@/pages/CoachPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));

// Lazy load non-critical components
const PWAInstallPrompt = lazy(() => import("@/components/PWAInstallPrompt").then(m => ({ default: m.PWAInstallPrompt })));
const AppUpdateBanner = lazy(() => import("@/components/AppUpdateBanner").then(m => ({ default: m.AppUpdateBanner })));

// F) Android debug panel - lazy loaded, shown only with ?insetsDebug=1 on Android
const AndroidDebugPanel = lazy(() => import("@/components/AndroidDebugPanel"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
      gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache
      refetchOnWindowFocus: false, // prevent unnecessary refetches
      retry: 1, // reduce retry attempts
    },
  },
});

// Component that initializes deep link handling inside BrowserRouter
const DeepLinkHandler = ({ children }: { children: React.ReactNode }) => {
  useDeepLink();
  return <>{children}</>;
};

// Safe Area Initializer - inject CSS variables for safe area insets
const SafeAreaInitializer = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // Only run on native platforms (iOS/Android)
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let listener: any;

    const initSafeArea = async () => {
      try {
        // Get initial safe area insets
        const { insets } = await SafeArea.getSafeAreaInsets();
        
        // Inject CSS variables into document root
        for (const [key, value] of Object.entries(insets)) {
          document.documentElement.style.setProperty(
            `--safe-area-inset-${key}`,
            `${value}px`
          );
        }

        // Listen for changes (e.g., device rotation, keyboard)
        listener = await SafeArea.addListener('safeAreaChanged', ({ insets }) => {
          for (const [key, value] of Object.entries(insets)) {
            document.documentElement.style.setProperty(
              `--safe-area-inset-${key}`,
              `${value}px`
            );
          }
        });
      } catch (error) {
        console.error('Failed to initialize safe area:', error);
      }
    };

    initSafeArea();

    // Cleanup listener on unmount
    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, []);

  // Android keyboard configuration - use native resize mode for better IME handling
  useEffect(() => {
    const { isAndroid } = getPlatformInfo();
    
    if (isAndroid) {
      Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch((err) => {
        console.warn('Failed to set keyboard resize mode:', err);
      });
    }
  }, []);

  return <>{children}</>;
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <SafeAreaInitializer>
        <IOSKeyboardProvider>
          <LayoutProvider>
            <TooltipProvider>
              {/* F) Android Debug Panel - visible only with ?insetsDebug=1 on Android */}
              <Suspense fallback={null}>
                <AndroidDebugPanel />
              </Suspense>
              <BrowserRouter>
                <KeyboardWarning />
                <DeepLinkHandler>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/onboarding" element={
                      <Suspense fallback={<div className="min-h-screen bg-background" />}>
                        <OnboardingPage />
                      </Suspense>
                    } />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                  
                    {/* Protected routes - require authentication */}
                    <Route
                      path="/"
                      element={
                        <AuthGuard>
                          <RevenueCatProvider>
                            <UserDataProvider>
                              <DemoModeProvider>
                                <Suspense fallback={null}>
                                  <AppUpdateBanner />
                                  <PWAInstallPrompt />
                                </Suspense>
                                <Layout />
                              </DemoModeProvider>
                            </UserDataProvider>
                          </RevenueCatProvider>
                        </AuthGuard>
                      }
                    >
                      <Route index element={
                        <Suspense fallback={<HomePageSkeleton />}>
                          <HomePage />
                        </Suspense>
                      } />
                      <Route path="photos" element={
                        <Suspense fallback={<PhotoDiaryPageSkeleton />}>
                          <PhotoDiaryPage />
                        </Suspense>
                      } />
                      <Route path="check-in" element={
                        <Suspense fallback={<CheckInPageSkeleton />}>
                          <CheckInPage />
                        </Suspense>
                      } />
                      <Route path="insights" element={
                        <Suspense fallback={<InsightsPageSkeleton />}>
                          <InsightsPage />
                        </Suspense>
                      } />
                      <Route path="community" element={
                        <Suspense fallback={<CommunityPageSkeleton />}>
                          <CommunityPage />
                        </Suspense>
                      } />
                      <Route path="resources" element={
                        <Suspense fallback={<GenericPageSkeleton />}>
                          <ResourcesPage />
                        </Suspense>
                      } />
                      <Route path="resources/:id" element={
                        <Suspense fallback={<GenericPageSkeleton />}>
                          <ResourceDetailPage />
                        </Suspense>
                      } />
                      <Route path="journal" element={
                        <Suspense fallback={<JournalPageSkeleton />}>
                          <JournalPage />
                        </Suspense>
                      } />
                      <Route path="coach" element={
                        <Suspense fallback={<CoachPageSkeleton />}>
                          <CoachPage />
                        </Suspense>
                      } />
                      <Route path="settings" element={
                        <Suspense fallback={<SettingsPageSkeleton />}>
                          <SettingsPage />
                        </Suspense>
                      } />
                      <Route path="admin" element={
                        <Suspense fallback={<GenericPageSkeleton />}>
                          <AdminPage />
                        </Suspense>
                      } />
                    </Route>
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </DeepLinkHandler>
              </BrowserRouter>
            </TooltipProvider>
          </LayoutProvider>
        </IOSKeyboardProvider>
      </SafeAreaInitializer>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;