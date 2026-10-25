import { Box, Button } from "@mui/material";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { StateCard } from "./StateCard";

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last line of defence. The API's shape is asserted, not validated at runtime,
 * so a missing or renamed field (say `audit: null`) would make React unmount the
 * whole tree and leave a blank white page with no explanation. Catching it here
 * keeps the failure visible and recoverable instead.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Deliberate: an unexpected render error must reach the console for whoever
    // is debugging, even though the user only sees the card.
    console.error("Unhandled dashboard error", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <StateCard
        role="alert"
        tone="error"
        title="The dashboard hit an unexpected error"
        icon={<span aria-hidden="true">⚠️</span>}
        message={
          <>
            A record from the API did not match the shape this screen expects, so
            the view could not render. Nothing was changed on the server — reload
            to try again.
            <Box
              component="p"
              sx={{ mt: 1.5, fontFamily: "monospace", fontSize: "0.75rem", wordBreak: "break-word" }}
            >
              {error.message}
            </Box>
          </>
        }
        action={
          <Button variant="contained" onClick={() => window.location.reload()}>
            Reload
          </Button>
        }
      />
    );
  }
}
