import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { UserDataProvider } from "@/contexts/UserDataContext";
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
import AdminPage from "@/pages/AdminPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <UserDataProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public route - Auth page */}
            <Route path="/auth" element={<AuthPage />} />
            
            {/* Protected routes - require authentication */}
            <Route
              path="/"
              element={
                <AuthGuard>
                  <Layout />
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
        </BrowserRouter>
      </TooltipProvider>
    </UserDataProvider>
  </QueryClientProvider>
);

export default App;
