import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SplashScreen from "./components/SplashScreen";
import Welcome from "./pages/Welcome";
import HowItWorks from "./pages/HowItWorks";
import DisabilitySelection from "./pages/DisabilitySelection";
import EmergencyContacts from "./pages/EmergencyContacts";
import PermissionsSetup from "./pages/PermissionsSetup";
import Home from "./pages/Home";
import Activity from "./pages/Activity";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Store online status globally
  useEffect(() => {
    (window as unknown as { __isOnline: boolean }).__isOnline = isOnline;
  }, [isOnline]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {showSplash && (
          <SplashScreen onComplete={() => setShowSplash(false)} duration={1500} />
        )}
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/onboarding/how-it-works" element={<HowItWorks />} />
            <Route path="/onboarding/disability" element={<DisabilitySelection />} />
            <Route path="/onboarding/contacts" element={<EmergencyContacts />} />
            <Route path="/onboarding/permissions" element={<PermissionsSetup />} />
            <Route path="/home" element={<Home />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
