import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import type { Incident } from "../api/types";
import { ThemeProvider } from "../theme/ThemeProvider";

export function makeIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    incident_id: "inc_test_1",
    schema_version: "1.0",
    status: "open",
    severity: "critical",
    affected_entities: [{ host: "web-01", service: "checkout", source: "app-nginx" }],
    anomaly_score: 6.4,
    detector: "statistical_baseline",
    model_versions: { baseline: "2026.10.1" },
    windows: [
      { start: "2026-10-24T10:00:00+00:00", end: "2026-10-24T10:05:00+00:00" },
    ],
    evidence: {
      supporting_event_ids: ["evt_1", "evt_2"],
      contradicting_event_ids: [],
      redacted_refs: ["logs/web-01/checkout.log#L2041"],
    },
    hypotheses: [
      {
        statement: "Checkout 5xx errors may be caused by an unhealthy payments dependency.",
        confidence: "medium",
        supporting_event_ids: ["evt_1"],
        contradicting_event_ids: [],
        missing_evidence: ["dependency latency metrics for db-pay-primary"],
      },
      {
        statement: "Cause is currently unknown; evidence is too narrow to decide.",
        confidence: "unknown",
        supporting_event_ids: [],
        contradicting_event_ids: [],
        missing_evidence: ["external dependency health checks"],
      },
    ],
    diagnostic_checks: [
      {
        instruction: "Compare checkout 5xx rate with the trailing 24h baseline.",
        evidence_links: ["evt_1"],
        executes: false,
      },
    ],
    created_at: "2026-10-24T10:00:00+00:00",
    updated_at: "2026-10-24T10:00:00+00:00",
    audit: [],
    ...overrides,
  };
}

function testQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  { route = "/" }: { route?: string } = {},
) {
  return render(
    <ThemeProvider>
      <QueryClientProvider client={testQueryClient()}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

/** Render a detail page under a real route so `useParams` is populated. */
export function renderDetail(element: ReactElement, incidentId: string) {
  return render(
    <ThemeProvider>
      <QueryClientProvider client={testQueryClient()}>
        <MemoryRouter initialEntries={[`/incidents/${incidentId}`]}>
          <Routes>
            <Route path="/incidents/:incidentId" element={element} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}
