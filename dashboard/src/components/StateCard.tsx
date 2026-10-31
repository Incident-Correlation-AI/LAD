import { Box, Button, Paper, Stack, Typography, alpha, useTheme } from "@mui/material";
import type { ReactNode } from "react";

import { ApiError } from "../api/client";

/**
 * Single terminal card for loading / empty / error states.
 * Preserves the ARIA roles the tests and screen readers rely on.
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
    accentColor ?? (tone === "error" ? theme.custom.errorRed500 : theme.custom.torchGold600);

  return (
    <Paper
      role={role}
      aria-live={role === "status" ? "polite" : undefined}
      sx={{
        maxWidth: 580,
        mx: "auto",
        mt: 4,
        p: 4,
        textAlign: "center",
        bgcolor: "#0B0F0C",
        border: `1px solid ${tone === "error" ? "rgba(239, 68, 68, 0.5)" : "rgba(122, 139, 128, 0.35)"}`,
        borderRadius: 0,
        boxShadow: "none",
        fontFamily: '"JetBrains Mono", monospace',
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          mx: "auto",
          mb: 2,
          borderRadius: 0,
          border: `1px solid ${alpha(accent, 0.4)}`,
          display: "grid",
          placeItems: "center",
          bgcolor: alpha(accent, 0.08),
          color: accent,
          fontSize: "1.25rem",
        }}
      >
        {icon}
      </Box>

      <Typography
        variant="h6"
        sx={{
          mb: 1.5,
          fontFamily: '"JetBrains Mono", monospace',
          fontWeight: 700,
          fontSize: "1.25rem",
          color: theme.custom.classroomSlate900,
        }}
      >
        {title}
      </Typography>

      <Typography
        variant="body2"
        component="div"
        sx={{
          color: theme.custom.classroomSlate500,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "0.92rem",
          lineHeight: 1.65,
          "& code": {
            fontSize: "0.88rem",
            color: "#E8A65D",
            bgcolor: "rgba(232, 166, 93, 0.08)",
            px: 0.75,
            py: 0.35,
            border: "1px solid rgba(232, 166, 93, 0.25)",
          },
        }}
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
          <Button
            variant="outlined"
            onClick={retry}
            sx={{
              borderRadius: 0,
              fontFamily: '"JetBrains Mono", monospace',
              color: "#D7E0D9",
              borderColor: "rgba(122, 139, 128, 0.4)",
              "&:hover": {
                borderColor: "#E8A65D",
                color: "#E8A65D",
              },
            }}
          >
            [ Try again ]
          </Button>
        ) : undefined
      }
    />
  );
}
