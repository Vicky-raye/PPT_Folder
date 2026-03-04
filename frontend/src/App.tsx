import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { fetchCourses } from "@/lib/api";
import Index from "./pages/Index";
import CoursePage from "./pages/CoursePage";
import WorkspacePage from "./pages/WorkspacePage";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    },
  },
});

function PrefetchCourses() {
  const qc = useQueryClient();
  useEffect(() => {
    qc.prefetchQuery({ queryKey: ["courses"], queryFn: () => fetchCourses() });
  }, [qc]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PrefetchCourses />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/course/:courseId" element={<CoursePage />} />
          <Route path="/workspace/:pptId" element={<ErrorBoundary><WorkspacePage /></ErrorBoundary>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
