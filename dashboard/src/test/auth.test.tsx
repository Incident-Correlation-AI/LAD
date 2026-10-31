import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { App } from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { setStoredToken, TOKEN_STORAGE_KEY } from "../auth/jwt";
import { ThemeProvider } from "../theme/ThemeProvider";

function makeJwt(payload: object): string {
  const b64 = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.signaturesimulation`;
}

function renderApp(initialEntry = "/") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  });

  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe("Dashboard Auth & Verification", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("renders authenticated dashboard when valid token is in storage", async () => {
    const validExp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeJwt({ sub: "sec_admin", role: "admin", exp: validExp });
    setStoredToken(token);

    renderApp("/");

    expect(await screen.findByText(/user: sec_admin/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Incidents$/i })).toBeInTheDocument();
  });

  it("clears token on logout", async () => {
    const user = userEvent.setup();
    const validExp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeJwt({ sub: "admin", role: "admin", exp: validExp });
    setStoredToken(token);

    renderApp("/");

    const logoutBtn = await screen.findByRole("button", { name: /logout/i });
    await user.click(logoutBtn);

    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });
});
