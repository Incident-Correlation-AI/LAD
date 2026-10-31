import { Box, Button, Paper, Stack, Typography } from "@mui/material";

export function UnauthorizedScreen({ error }: { error?: string | null }) {
  const landingUrl =
    import.meta.env.VITE_LANDING_URL ||
    (window.location.hostname === "localhost" ? "http://localhost:5173" : "/");

  const loginUrl = `${landingUrl.replace(/\/$/, "")}/login`;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#0B0F0C",
        color: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 2, sm: 4 },
        fontFamily: '"JetBrains Mono", monospace',
      }}
    >
      <Paper
        sx={{
          width: "100%",
          maxWidth: 680,
          bgcolor: "#0B0F0C",
          border: "1px solid rgba(162, 181, 168, 0.45)",
          borderRadius: 0,
          boxShadow: "none",
          overflow: "hidden",
        }}
      >
        {/* Terminal Chrome Bar */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1.25,
            bgcolor: "#0B0F0C",
            borderBottom: "1px solid rgba(162, 181, 168, 0.35)",
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "0.8rem",
            color: "#BACBC1",
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50% !important",
                bgcolor: "#ef4444",
              }}
            />
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50% !important",
                bgcolor: "#eab308",
              }}
            />
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50% !important",
                bgcolor: "#22c55e",
              }}
            />
            <Typography
              component="span"
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "0.8rem",
                color: "#BACBC1",
                ml: 1,
              }}
            >
              lad@gateway: ~/session-verify
            </Typography>
          </Stack>
          <Typography
            component="span"
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.75rem",
              color: "#E8A65D",
            }}
          >
            [ RESTRICTED ]
          </Typography>
        </Box>

        {/* Terminal Body */}
        <Box sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.9rem",
              color: "#D2DFD7",
              mb: 2,
            }}
          >
            $ verify-session --query-param=token --target=telemetry-console
          </Typography>

          {/* Alert Box */}
          <Box
            sx={{
              p: 2.5,
              mb: 3,
              border: "1px solid #F87171",
              bgcolor: "rgba(239, 68, 68, 0.08)",
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "1rem",
                fontWeight: 700,
                color: "#F87171",
                mb: 1,
              }}
            >
              [ACCESS DENIED] 401 UNAUTHORIZED
            </Typography>
            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "0.85rem",
                color: "#FFFFFF",
                lineHeight: 1.6,
              }}
            >
              The telemetry console requires a signed cryptographic session
              token to inspect real-time log anomaly models and incident data.
            </Typography>
            {error && (
              <Box
                sx={{
                  mt: 2,
                  pt: 1.5,
                  borderTop: "1px dashed rgba(239, 68, 68, 0.3)",
                  color: "#E8A65D",
                  fontSize: "0.8rem",
                  fontFamily: '"JetBrains Mono", monospace',
                }}
              >
                Diagnostic: {error}
              </Box>
            )}
          </Box>

          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.82rem",
              color: "#BACBC1",
              mb: 3,
              lineHeight: 1.6,
            }}
          >
            Please authenticate through the landing page login gateway. Upon
            successful verification, you will be redirected here with an authorized
            session token (<Box component="code" sx={{ color: "#E8A65D" }}>?token=&lt;jwt&gt;</Box>).
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button
              href={loginUrl}
              variant="outlined"
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                color: "#0B0F0C",
                bgcolor: "#E8A65D",
                borderColor: "#E8A65D",
                borderRadius: 0,
                fontWeight: 700,
                px: 3,
                py: 1.25,
                textTransform: "none",
                "&:hover": {
                  bgcolor: "#f0b46e",
                  borderColor: "#f0b46e",
                },
              }}
            >
              [ --&gt; Go to Login Gateway ]
            </Button>
            <Button
              href={landingUrl}
              variant="outlined"
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                color: "#FFFFFF",
                borderColor: "rgba(162, 181, 168, 0.45)",
                borderRadius: 0,
                fontWeight: 600,
                px: 3,
                py: 1.25,
                textTransform: "none",
                "&:hover": {
                  borderColor: "#E8A65D",
                  color: "#E8A65D",
                  bgcolor: "rgba(232, 166, 93, 0.1)",
                },
              }}
            >
              [ Landing Page ]
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
