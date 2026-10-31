import { Box, CircularProgress } from "@mui/material";
import { Navigate, Route, Routes } from "react-router-dom";

import { TopBar } from "./components/TopBar";
import { IncidentDetail } from "./pages/IncidentDetail";
import { IncidentList } from "./pages/IncidentList";
import { UnauthorizedScreen } from "./components/UnauthorizedScreen";
import { useAuth } from "./auth/AuthContext";
export function App() {
  const { isAuthenticated, isLoading, error } = useAuth();

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "#0B0F0C",
          display: "grid",
          placeItems: "center",
          color: "#E8A65D",
          fontFamily: '"JetBrains Mono", monospace',
        }}
      >
        <Box sx={{ textAlign: "center" }}>
          <CircularProgress size={28} sx={{ color: "#E8A65D", mb: 2 }} />
          <Box sx={{ color: "#BACBC1", fontSize: "0.85rem", fontWeight: 600 }}>
            $ verifying session credentials...
          </Box>
        </Box>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <UnauthorizedScreen error={error} />;
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
      <TopBar />
      <Box
        component="main"
        sx={{
          maxWidth: 1320,
          mx: "auto",
          px: { xs: 3, sm: 5, md: 7, lg: 9 },
          py: { xs: 3.5, md: 5 },
        }}
      >
        <Routes>
          <Route path="/" element={<IncidentList />} />
          <Route path="/incidents/:incidentId" element={<IncidentDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </Box>
  );
}
