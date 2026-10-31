import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, fetchIncidents } from "../api/client";
import type { Incident, IncidentList as IncidentListPayload } from "../api/types";
import { IncidentList } from "../pages/IncidentList";
import { makeIncident, renderWithProviders } from "../test/utils";

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return {
    ...actual,
    fetchIncidents: vi.fn(),
    fetchIncident: vi.fn(),
    acknowledgeIncident: vi.fn(),
    resolveIncident: vi.fn(),
  };
});

const mockedFetchIncidents = vi.mocked(fetchIncidents);

/** The summary cards count with limit=100; page requests use limit=20. */
const isCountQuery = (filters: { limit?: number }) => filters.limit === 100;

/**
 * Serve `pages` in order for list requests, and an empty page for the summary
 * queries, so assertions target the list behaviour under test.
 */
function mockListPages(pages: IncidentListPayload[]) {
  let index = 0;
  mockedFetchIncidents.mockImplementation((filters) => {
    if (isCountQuery(filters)) {
      return Promise.resolve({ items: [], next_cursor: null });
    }
    const page = pages[Math.min(index, pages.length - 1)];
    index += 1;
    return Promise.resolve(page);
  });
}

const listCalls = () => mockedFetchIncidents.mock.calls.filter(([filters]) => !isCountQuery(filters));

describe("IncidentList", () => {
  beforeEach(() => {
    mockedFetchIncidents.mockReset();
  });

  it("shows a loading state while the request is pending", () => {
    mockedFetchIncidents.mockReturnValue(new Promise<IncidentListPayload>(() => {}));
    renderWithProviders(<IncidentList />);
    expect(screen.getByRole("status")).toHaveTextContent(/loading incidents/i);
    // Counts are unknown yet: a literal "0" would be a claim, not a placeholder.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows an empty state that avoids implying the system is healthy", async () => {
    mockListPages([{ items: [], next_cursor: null }]);
    renderWithProviders(<IncidentList />);

    expect(await screen.findByText(/no incidents match these filters/i)).toBeInTheDocument();
    expect(screen.getByText(/not proof that everything is healthy/i)).toBeInTheDocument();
  });

  it("surfaces an auth misconfiguration instead of pretending the list is empty", async () => {
    mockedFetchIncidents.mockRejectedValue(new ApiError(401, "Missing bearer credential"));
    renderWithProviders(<IncidentList />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/not authenticated/i);
    expect(screen.getByText(/LAD_ADMIN_TOKEN/)).toBeInTheDocument();
  });

  it("renders incidents and labels the score as non-probabilistic", async () => {
    mockListPages([{ items: [makeIncident()], next_cursor: null }]);
    renderWithProviders(<IncidentList />);

    expect(await screen.findByText("inc_test_1")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText("critical")).toBeInTheDocument();
    expect(screen.getByText("6.40")).toBeInTheDocument();
    expect(screen.getByTitle(/not a probability/i)).toBeInTheDocument();
  });

  it("keeps filters in the URL and refetches with them", async () => {
    mockListPages([{ items: [], next_cursor: null }]);
    const user = userEvent.setup();
    renderWithProviders(<IncidentList />, { route: "/?severity=high" });

    await waitFor(() => expect(listCalls().length).toBeGreaterThan(0));
    expect(listCalls().at(-1)?.[0]).toMatchObject({ severity: "high" });

    // MUI Select is a combobox + listbox, not a native <select>.
    await user.click(screen.getByRole("combobox", { name: /status/i }));
    await user.click(await screen.findByRole("option", { name: "resolved" }));

    await waitFor(() => {
      expect(listCalls().at(-1)?.[0]).toMatchObject({ severity: "high", status: "resolved" });
    });
  });

  it("paginates with the opaque cursor from the previous page", async () => {
    mockListPages([
      { items: [makeIncident({ incident_id: "inc_page_1" })], next_cursor: "cursor-abc" },
      { items: [makeIncident({ incident_id: "inc_page_2" })], next_cursor: null },
    ]);

    const user = userEvent.setup();
    renderWithProviders(<IncidentList />);

    await screen.findByText("inc_page_1");
    await user.click(screen.getByRole("button", { name: /load more/i }));

    expect(await screen.findByText("inc_page_2")).toBeInTheDocument();
    expect(mockedFetchIncidents.mock.calls.map((call) => call[1])).toContain("cursor-abc");
    expect(screen.getByText(/end of results/i)).toBeInTheDocument();
  });

  it("caps summary counts honestly when a status has more than one page", async () => {
    const page: IncidentListPayload = {
      items: Array.from({ length: 100 }, (_, i) =>
        makeIncident({ incident_id: `inc_${i}` }),
      ),
      next_cursor: "more",
    };
    mockedFetchIncidents.mockImplementation((filters) => {
      if (!isCountQuery(filters)) {
        return Promise.resolve({ items: [], next_cursor: null });
      }
      if (filters.status === "open") return Promise.resolve(page);
      return Promise.resolve({ items: [], next_cursor: null });
    });

    renderWithProviders(<IncidentList />);

    // Not "100" — the API could not prove there are only 100. Both the "open"
    // tile and the severity total are capped, so both carry the marker.
    expect((await screen.findAllByText("100+")).length).toBeGreaterThanOrEqual(2);
  });

  it("ignores filter values the contract does not define", async () => {
    mockListPages([{ items: [], next_cursor: null }]);
    renderWithProviders(<IncidentList />, { route: "/?status=exploded&severity=critical" });

    await waitFor(() => expect(listCalls().length).toBeGreaterThan(0));
    // The bogus status is dropped instead of being sent and 422-ing the list.
    expect(listCalls().at(-1)?.[0]).toMatchObject({ severity: "critical" });
    expect(listCalls().at(-1)?.[0].status).toBeUndefined();
  });

  it("says the summary counts are unavailable instead of showing zeros", async () => {
    mockedFetchIncidents.mockImplementation((filters) => {
      if (isCountQuery(filters)) return Promise.reject(new ApiError(503, "Storage unavailable"));
      return Promise.resolve({ items: [], next_cursor: null });
    });

    renderWithProviders(<IncidentList />);

    expect(await screen.findByText(/summary counts are unavailable/i)).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    // The table itself still loads.
    expect(await screen.findByText(/no incidents match these filters/i)).toBeInTheDocument();
  });

  it("renders legacy incidents missing affected_entities without crashing", async () => {
    const legacyIncident = {
      incident_id: "legacy_inc_1",
      schema_version: "1.0",
      status: "open",
      severity: "high",
      anomaly_score: 0.0,
      detector: "statistical_baseline_mock",
      created_at: "2026-10-21T22:45:02.493758+00:00",
      updated_at: "2026-10-21T22:45:02.493758+00:00",
    } as unknown as Incident;

    mockListPages([{ items: [legacyIncident], next_cursor: null }]);
    renderWithProviders(<IncidentList />);

    expect(await screen.findByText("legacy_inc_1")).toBeInTheDocument();
  });

  it("refetches incidents when manual refresh button is clicked", async () => {
    let resolveRefetch: (val: IncidentListPayload) => void = () => {};
    mockListPages([{ items: [makeIncident()], next_cursor: null }]);
    const user = userEvent.setup();
    renderWithProviders(<IncidentList />);

    expect(await screen.findByText("inc_test_1")).toBeInTheDocument();

    mockedFetchIncidents.mockImplementation((filters) => {
      if (isCountQuery(filters)) {
        return Promise.resolve({ items: [], next_cursor: null });
      }
      return new Promise((resolve) => {
        resolveRefetch = resolve;
      });
    });

    await user.click(screen.getByRole("button", { name: /refresh/i }));

    // Button indicates refresh is underway
    expect(screen.getByRole("button", { name: /refresh/i })).toBeDisabled();

    resolveRefetch({ items: [makeIncident({ incident_id: "inc_refreshed" })], next_cursor: null });
    expect(await screen.findByText("inc_refreshed")).toBeInTheDocument();
  });
});
