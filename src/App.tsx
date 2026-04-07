import { useEffect } from 'react';
import { Toaster as Sonner } from "./components/ui/sonner";  // only Sonner
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { seedInitialData } from "./lib/seed";
import { ThemeProvider } from "./components/theme-provider";

// ... all your page imports ...

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    seedInitialData();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <TooltipProvider>
          <Sonner />  {/* only this toast component */}
          <BrowserRouter>
            <Routes>
              {/* your routes */}
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;