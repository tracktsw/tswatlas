import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LocalStorageProvider } from "@/contexts/LocalStorageContext";
import Layout from "@/components/Layout";
import HomePage from "@/pages/HomePage";
import PhotoDiaryPage from "@/pages/PhotoDiaryPage";
import CheckInPage from "@/pages/CheckInPage";
import InsightsPage from "@/pages/InsightsPage";
import CommunityPage from "@/pages/CommunityPage";
import JournalPage from "@/pages/JournalPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LocalStorageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="photos" element={<PhotoDiaryPage />} />
              <Route path="check-in" element={<CheckInPage />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="community" element={<CommunityPage />} />
              <Route path="journal" element={<JournalPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LocalStorageProvider>
  </QueryClientProvider>
);

export default App;
