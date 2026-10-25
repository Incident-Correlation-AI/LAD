import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./theme/ThemeProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Incident data changes only when the worker writes; a short stale window
      // avoids refetch storms while still feeling live.
      staleTime: 15_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
