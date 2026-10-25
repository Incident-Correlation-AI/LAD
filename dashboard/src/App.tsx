import { Box } from "@mui/material";
import { Navigate, Route, Routes } from "react-router-dom";

import { TopBar } from "./components/TopBar";
import { IncidentDetail } from "./pages/IncidentDetail";
import { IncidentList } from "./pages/IncidentList";

export function App() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <TopBar />
      <Box
        component="main"
        sx={{
          maxWidth: 1240,
          mx: "auto",
          px: { xs: 2, md: 4 },
          py: { xs: 3, md: 4 },
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
