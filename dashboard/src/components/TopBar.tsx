import { Box, Button, Chip, Stack, Typography, useTheme } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/**
 * Terminal top bar styled to match the landing-page window chrome.
 * Features window status dots, terminal path, environment badge,
 * authenticated user state, and session controls.
 */
export function TopBar() {
  const theme = useTheme();
  const { user, logout } = useAuth();

  const landingUrl =
    import.meta.env.VITE_LANDING_URL ||
    (window.location.hostname === "localhost" ? "http://localhost:5173" : "/");

  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: theme.zIndex.appBar,
        bgcolor: "#0B0F0C",
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Box
        sx={{
          maxWidth: 1240,
          mx: "auto",
          px: { xs: 2, md: 4 },
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        {/* Terminal Chrome & Title */}
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mr: 0.5 }}>
            <Box
              sx={{
                width: 9,
                height: 9,
                borderRadius: "50% !important",
                bgcolor: "#ef4444",
              }}
            />
            <Box
              sx={{
                width: 9,
                height: 9,
                borderRadius: "50% !important",
                bgcolor: "#eab308",
              }}
            />
            <Box
              sx={{
                width: 9,
                height: 9,
                borderRadius: "50% !important",
                bgcolor: "#22c55e",
              }}
            />
          </Stack>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            component={RouterLink}
            to="/"
            sx={{
              textDecoration: "none",
              color: "inherit",
              "&:hover .terminal-title": {
                color: "#f0b46e",
              },
            }}
          >
            <Typography
              component="span"
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "0.85rem",
                color: "#7A8B80",
                display: { xs: "none", sm: "inline" },
              }}
            >
              lad@telemetry: ~
            </Typography>
            <Typography
              className="terminal-title"
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 700,
                fontSize: "0.95rem",
                letterSpacing: "-0.01em",
                color: "#E8A65D",
                transition: "color 0.15s ease",
              }}
            >
              /dashboard
            </Typography>
          </Stack>
        </Stack>

        {/* Right side telemetry badges & auth controls */}
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Chip
            size="small"
            variant="outlined"
            label={import.meta.env.VITE_APP_ENV || "aws: eu-north-1"}
            sx={{
              display: { xs: "none", md: "inline-flex" },
              borderRadius: 0,
              borderColor: "rgba(122, 139, 128, 0.4)",
              bgcolor: "rgba(122, 139, 128, 0.08)",
              color: "#7A8B80",
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.72rem",
              fontWeight: 600,
            }}
          />

          {user && (
            <Chip
              size="small"
              variant="outlined"
              label={`[ user: ${user.username} ]`}
              sx={{
                borderRadius: 0,
                borderColor: "rgba(232, 166, 93, 0.4)",
                bgcolor: "rgba(232, 166, 93, 0.08)",
                color: "#E8A65D",
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "0.72rem",
                fontWeight: 600,
              }}
            />
          )}

          <Button
            href={landingUrl}
            size="small"
            variant="outlined"
            sx={{
              display: { xs: "none", sm: "inline-flex" },
              borderRadius: 0,
              px: 1.5,
              py: 0.5,
              borderColor: "rgba(122, 139, 128, 0.35)",
              color: "#D7E0D9",
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.75rem",
              textTransform: "none",
              "&:hover": {
                borderColor: "#7A8B80",
                bgcolor: "rgba(122, 139, 128, 0.1)",
              },
            }}
          >
            [ &lt;-- site ]
          </Button>

          <Button
            onClick={logout}
            size="small"
            variant="outlined"
            sx={{
              borderRadius: 0,
              px: 1.5,
              py: 0.5,
              borderColor: "rgba(239, 68, 68, 0.4)",
              color: "#EF4444",
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.75rem",
              textTransform: "none",
              "&:hover": {
                borderColor: "#EF4444",
                bgcolor: "rgba(239, 68, 68, 0.1)",
              },
            }}
          >
            [ logout ]
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
