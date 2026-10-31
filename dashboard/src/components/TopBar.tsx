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
          maxWidth: 1320,
          mx: "auto",
          px: { xs: 3, sm: 5, md: 7, lg: 9 },
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        {/* Terminal Chrome & Title */}
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "1rem",
              fontWeight: 800,
              color: "#E8A65D",
              mr: 0.75,
              lineHeight: 1,
            }}
          >
            &gt;_
          </Typography>

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
                fontSize: "0.92rem",
                color: "#A2B5A8",
                fontWeight: 600,
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
                fontSize: "1.05rem",
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
              borderColor: "rgba(162, 181, 168, 0.45)",
              bgcolor: "rgba(162, 181, 168, 0.08)",
              color: "#A2B5A8",
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.8rem",
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
                borderColor: "rgba(232, 166, 93, 0.5)",
                bgcolor: "rgba(232, 166, 93, 0.08)",
                color: "#E8A65D",
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "0.8rem",
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
              px: 1.75,
              py: 0.6,
              borderColor: "rgba(162, 181, 168, 0.4)",
              color: "#F0F5F2",
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.82rem",
              fontWeight: 600,
              textTransform: "none",
              "&:hover": {
                borderColor: "#A2B5A8",
                bgcolor: "rgba(162, 181, 168, 0.12)",
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
              px: 1.75,
              py: 0.6,
              borderColor: "rgba(239, 68, 68, 0.5)",
              color: "#EF4444",
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.82rem",
              fontWeight: 600,
              textTransform: "none",
              "&:hover": {
                borderColor: "#EF4444",
                bgcolor: "rgba(239, 68, 68, 0.12)",
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
