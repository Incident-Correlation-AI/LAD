import { Navigate, Route, Routes } from "react-router-dom";

import { IncidentDetail } from "./pages/IncidentDetail";
import { IncidentList } from "./pages/IncidentList";

export function App() {
  return (
    <div className="app">
      <header className="app-bar">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Log Anomaly Detector
        </span>
        <span className="muted small">local mode</span>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<IncidentList />} />
          <Route path="/incidents/:incidentId" element={<IncidentDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
