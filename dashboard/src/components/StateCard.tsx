import { Box, Button, Paper, Stack, Typography, alpha, useTheme } from "@mui/material";
import type { ReactNode } from "react";

import { ApiError } from "../api/client";

/**
 * Single card for loading / empty / error. Keeps the ARIA roles the tests and
 * screen readers rely on.
 */
export function StateCard({
  icon,
  title,
  message,
  action,
  accentColor,
  role,
  tone = "neutral",
}: {
  icon: ReactNode;
  title: string;
  message: ReactNode;
  action?: ReactNode;
  accentColor?: string;
  role?: "status" | "alert";
  tone?: "neutral" | "error";
}) {
  const theme = useTheme();
  const accent =
    accentColor ?? (tone === "error" ? theme.custom.errorRed500 : theme.custom.nileBlue600);

  return (
    <Paper
      role={role}
      aria-live={role === "status" ? "polite" : undefined}
      sx={{
        maxWidth: 560,
        mx: "auto",
        mt: 4,
        p: 4,
        textAlign: "center",
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          mx: "auto",
          mb: 2,
          borderRadius: 2,
          display: "grid",
          placeItems: "center",
          bgcolor: alpha(accent, 0.1),
          color: accent,
        }}
      >
        {icon}
      </Box>

      <Typography variant="h6" sx={{ mb: 1, color: theme.custom.classroomSlate900 }}>
        {title}
      </Typography>

      <Typography
        variant="body2"
        component="div"
        sx={{ color: theme.custom.classroomSlate600, "& code": { fontSize: "0.78rem" } }}
      >
        {message}
      </Typography>

      {action ? (
        <Stack direction="row" justifyContent="center" mt={3}>
          {action}
        </Stack>
      ) : null}
    </Paper>
  );
}

export function AuthConfigState({ error }: { error: unknown }) {
  const apiError = error instanceof ApiError ? error : undefined;
  return (
    <StateCard
      role="alert"
      tone="error"
      title="Dashboard is not authenticated"
      icon={<span aria-hidden="true">🔑</span>}
      message={
        <>
          The API rejected the request. The dev server injects the admin
          credential from <code>LAD_ADMIN_TOKEN</code> (<code>dashboard/.env.local</code>{" "}
          or the repo-root <code>.env</code>). Restart <code>npm run dev</code>{" "}
          after setting it.
          {apiError?.requestId ? (
            <Box component="p" sx={{ mt: 1.5, fontFamily: "monospace", fontSize: "0.75rem" }}>
              request_id {apiError.requestId}
            </Box>
          ) : null}
        </>
      }
    />
  );
}

export function ApiErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const apiError = error instanceof ApiError ? error : undefined;
  if (apiError?.isAuthConfigProblem) return <AuthConfigState error={error} />;

  return (
    <StateCard
      role="alert"
      tone="error"
      title="Could not load data"
      icon={<span aria-hidden="true">⚠️</span>}
      message={
        <>
          {error instanceof Error ? error.message : String(error)}
          {apiError?.details?.length ? (
            <Box component="ul" sx={{ textAlign: "left", mt: 1.5, pl: 2.5, fontSize: "0.8rem" }}>
              {apiError.details.slice(0, 4).map((detail) => (
                <li key={`${detail.field}-${detail.reason}`}>
                  <Box component="code" sx={{ fontSize: "0.75rem" }}>
                    {detail.field}
                  </Box>
                  {": "}
                  {detail.reason}
                </li>
              ))}
            </Box>
          ) : null}
          {apiError?.requestId ? (
            <Box component="p" sx={{ mt: 1.5, fontFamily: "monospace", fontSize: "0.75rem" }}>
              request_id {apiError.requestId}
            </Box>
          ) : null}
        </>
      }
      action={
        retry ? (
          <Button variant="contained" onClick={retry}>
            Try again
          </Button>
        ) : undefined
      }
    />
  );
}
