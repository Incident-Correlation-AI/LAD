import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { acknowledgeIncident, fetchIncident, resolveIncident } from "../api/client";
import { IncidentDetail } from "../pages/IncidentDetail";
import { makeIncident, renderDetail } from "../test/utils";

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

const mockedFetchIncident = vi.mocked(fetchIncident);
const mockedAcknowledge = vi.mocked(acknowledgeIncident);
const mockedResolve = vi.mocked(resolveIncident);

describe("IncidentDetail", () => {
  beforeEach(() => {
    mockedFetchIncident.mockReset();
    mockedAcknowledge.mockReset();
    mockedResolve.mockReset();
  });

  it("separates score, severity and hypothesis support", async () => {
    mockedFetchIncident.mockResolvedValue(makeIncident());
    renderDetail(<IncidentDetail />, "inc_test_1");

    expect(await screen.findByText("inc_test_1")).toBeInTheDocument();
    expect(screen.getAllByTitle(/not a probability/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/estimated operational impact/i)).toBeInTheDocument();
    expect(screen.getByText("medium support")).toBeInTheDocument();
  });

  it("renders unknown confidence as a valid outcome", async () => {
    mockedFetchIncident.mockResolvedValue(makeIncident());
    renderDetail(<IncidentDetail />, "inc_test_1");

    expect(await screen.findByText("unknown")).toBeInTheDocument();
    expect(screen.getByText(/valid result/i)).toBeInTheDocument();
  });

  it("always shows contradicting evidence, even when empty", async () => {
    mockedFetchIncident.mockResolvedValue(makeIncident());
    renderDetail(<IncidentDetail />, "inc_test_1");

    expect(await screen.findByText(/contradicting evidence/i)).toBeInTheDocument();
    expect(screen.getAllByText(/none recorded/i).length).toBeGreaterThan(0);
  });

  it("links supporting evidence back to the incident", async () => {
    mockedFetchIncident.mockResolvedValue(makeIncident());
    renderDetail(<IncidentDetail />, "inc_test_1");

    const links = await screen.findAllByRole("link", { name: "evt_1" });
    expect(links[0]).toHaveAttribute("href", "/incidents/inc_test_1");
    // Redacted references are archive positions, not incident links.
    expect(
      screen.queryByRole("link", { name: /checkout-2026-10-22/ }),
    ).not.toBeInTheDocument();
  });

  it("marks diagnostic checks as not executed automatically", async () => {
    mockedFetchIncident.mockResolvedValue(makeIncident());
    renderDetail(<IncidentDetail />, "inc_test_1");

    expect(await screen.findByText(/not executed automatically/i)).toBeInTheDocument();
    expect(screen.getByText(/never remediates/i)).toBeInTheDocument();
  });

  it("disables acknowledge once the incident is not open", async () => {
    mockedFetchIncident.mockResolvedValue(makeIncident({ status: "resolved" }));
    renderDetail(<IncidentDetail />, "inc_test_1");

    const acknowledge = await screen.findByRole("button", { name: /acknowledge/i });
    const resolve = screen.getByRole("button", { name: /resolve/i });
    expect(acknowledge).toBeDisabled();
    expect(resolve).toBeDisabled();
  });

  it("sends the lifecycle action and re-renders the server response", async () => {
    mockedFetchIncident.mockResolvedValue(makeIncident());
    mockedAcknowledge.mockResolvedValue(makeIncident({ status: "acknowledged" }));

    const user = userEvent.setup();
    renderDetail(<IncidentDetail />, "inc_test_1");

    await user.click(await screen.findByRole("button", { name: /acknowledge/i }));

    expect(mockedAcknowledge).toHaveBeenCalledWith("inc_test_1");
    expect(await screen.findByText("acknowledged")).toBeInTheDocument();
  });

  it("resolves an acknowledged incident and shows the server's record", async () => {
    mockedFetchIncident.mockResolvedValue(makeIncident({ status: "acknowledged" }));
    mockedResolve.mockResolvedValue(makeIncident({ status: "resolved" }));

    const user = userEvent.setup();
    renderDetail(<IncidentDetail />, "inc_test_1");

    await user.click(await screen.findByRole("button", { name: /^resolve$/i }));

    expect(mockedResolve).toHaveBeenCalledWith("inc_test_1");
    expect(await screen.findByText("resolved")).toBeInTheDocument();
    // The detail cache must not be refetched back to the pre-action state.
    expect(mockedFetchIncident).toHaveBeenCalledTimes(1);
  });

  it("renders attacker-controlled log text as text, never as HTML (XSS)", async () => {
    const payload = '<script>alert("xss")</script>';
    mockedFetchIncident.mockResolvedValue(
      makeIncident({
        affected_entities: [{ host: payload, service: null, source: null }],
        hypotheses: [
          {
            statement: payload,
            confidence: "low",
            supporting_event_ids: [payload],
            contradicting_event_ids: [],
            missing_evidence: [payload],
          },
        ],
        diagnostic_checks: [
          { instruction: payload, evidence_links: [payload], executes: false },
        ],
      }),
    );

    const { container } = renderDetail(<IncidentDetail />, "inc_test_1");

    // The payload appears as literal text (escaped), in every place it occurs.
    const rendered = await screen.findAllByText(payload);
    expect(rendered.length).toBeGreaterThan(0);
    // ...and no script element was created from it.
    expect(container.querySelectorAll("script")).toHaveLength(0);
    expect(container.innerHTML).toContain("&lt;script&gt;");
    expect(container.innerHTML).not.toContain("<script>alert");
  });
});
