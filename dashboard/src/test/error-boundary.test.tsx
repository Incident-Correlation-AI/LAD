import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "../components/ErrorBoundary";
import { renderWithProviders } from "./utils";

function Exploding(): never {
  throw new Error("audit is null");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // React logs the error itself; silencing keeps the test output readable.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps a render crash visible instead of blanking the page", () => {
    renderWithProviders(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/unexpected error/i);
    expect(alert).toHaveTextContent(/audit is null/);
    expect(alert).toHaveTextContent(/nothing was changed on the server/i);
    expect(screen.getByRole("button", { name: /reload/i })).toBeInTheDocument();
  });

  it("renders children untouched when nothing throws", () => {
    renderWithProviders(
      <ErrorBoundary>
        <p>healthy tree</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("healthy tree")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
