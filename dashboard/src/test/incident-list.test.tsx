import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, fetchIncidents } from "../api/client";
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

describe("IncidentList", () => {
  beforeEach(() => {
    mockedFetchIncidents.mockReset();
  });

  it("shows a loading state while the request is pending", () => {
    mockedFetchIncidents.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<IncidentList />);
    expect(screen.getByRole("status")).toHaveTextContent(/loading incidents/i);
  });

  it("shows an empty state that avoids implying the system is healthy", async () => {
    mockedFetchIncidents.mockResolvedValue({ items: [], next_cursor: null });
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
    mockedFetchIncidents.mockResolvedValue({
      items: [makeIncident()],
      next_cursor: null,
    });
    renderWithProviders(<IncidentList />);

    expect(await screen.findByText("inc_test_1")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText("critical")).toBeInTheDocument();
    expect(screen.getByText("6.40")).toBeInTheDocument();
    expect(screen.getByTitle(/not a probability/i)).toBeInTheDocument();
  });

  it("keeps filters in the URL and refetches with them", async () => {
    mockedFetchIncidents.mockResolvedValue({ items: [], next_cursor: null });
    const user = userEvent.setup();
    renderWithProviders(<IncidentList />, { route: "/?severity=high" });

    await waitFor(() => expect(mockedFetchIncidents).toHaveBeenCalled());
    expect(mockedFetchIncidents.mock.calls.at(-1)?.[0]).toMatchObject({ severity: "high" });

    await user.selectOptions(screen.getByLabelText(/status/i), "resolved");

    await waitFor(() => {
      const lastFilters = mockedFetchIncidents.mock.calls.at(-1)?.[0];
      expect(lastFilters).toMatchObject({ severity: "high", status: "resolved" });
    });
  });

  it("paginates with the opaque cursor from the previous page", async () => {
    mockedFetchIncidents
      .mockResolvedValueOnce({
        items: [makeIncident({ incident_id: "inc_page_1" })],
        next_cursor: "cursor-abc",
      })
      .mockResolvedValueOnce({
        items: [makeIncident({ incident_id: "inc_page_2" })],
        next_cursor: null,
      });

    const user = userEvent.setup();
    renderWithProviders(<IncidentList />);

    await screen.findByText("inc_page_1");
    await user.click(screen.getByRole("button", { name: /load more/i }));

    expect(await screen.findByText("inc_page_2")).toBeInTheDocument();
    expect(mockedFetchIncidents.mock.calls.at(-1)?.[1]).toBe("cursor-abc");
    expect(screen.getByText(/end of results/i)).toBeInTheDocument();
  });
});
