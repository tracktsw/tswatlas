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
import HomePage from "@/pages/HomePage";
import PhotoDiaryPage from "@/pages/PhotoDiaryPage";
import CheckInPage from "@/pages/CheckInPage";
import InsightsPage from "@/pages/InsightsPage";
import CommunityPage from "@/pages/CommunityPage";
import JournalPage from "@/pages/JournalPage";
import CoachPage from "@/pages/CoachPage";
import SettingsPage from "@/pages/SettingsPage";
import AuthPage from "@/pages/AuthPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import AdminPage from "@/pages/AdminPage";
import NotFound from "@/pages/NotFound";
import { useDeepLink } from "@/hooks/useDeepLink";

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
                  <Route index element={<HomePage />} />
                  <Route path="photos" element={<PhotoDiaryPage />} />
                  <Route path="check-in" element={<CheckInPage />} />
                  <Route path="insights" element={<InsightsPage />} />
                  <Route path="community" element={<CommunityPage />} />
                  <Route path="journal" element={<JournalPage />} />
                  <Route path="coach" element={<CoachPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="admin" element={<AdminPage />} />
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
