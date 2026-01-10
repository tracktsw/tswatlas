import { lazy, Suspense } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

// Lazy load all page components for faster initial load
const HomePage = lazy(() => import("@/pages/HomePage"));
const PhotoDiaryPage = lazy(() => import("@/pages/PhotoDiaryPage"));
const CheckInPage = lazy(() => import("@/pages/CheckInPage"));
const InsightsPage = lazy(() => import("@/pages/InsightsPage"));
const CommunityPage = lazy(() => import("@/pages/CommunityPage"));
const JournalPage = lazy(() => import("@/pages/JournalPage"));
const CoachPage = lazy(() => import("@/pages/CoachPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));

// Lazy load non-critical components
const PWAInstallPrompt = lazy(() => import("@/components/PWAInstallPrompt").then(m => ({ default: m.PWAInstallPrompt })));
const AppUpdateBanner = lazy(() => import("@/components/AppUpdateBanner").then(m => ({ default: m.AppUpdateBanner })));

const queryClient = new QueryClient();

// Component that initializes deep link handling inside BrowserRouter
const DeepLinkHandler = ({ children }: { children: React.ReactNode }) => {
  useDeepLink();
  return <>{children}</>;
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <IOSKeyboardProvider>
        <LayoutProvider>
          <TooltipProvider>
            <BrowserRouter>
              <DeepLinkHandler>
                <Routes>
                  {/* Public routes - no UserDataProvider */}
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
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
