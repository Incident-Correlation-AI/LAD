import { Box, Chip, Stack, Typography, useTheme } from "@mui/material";
import MonitorHeartOutlinedIcon from "@mui/icons-material/MonitorHeartOutlined";
import { Link as RouterLink } from "react-router-dom";

/**
 * Single top bar — no sidebar. The product has exactly two screens (list and
 * detail), so navigation chrome would be furniture with nothing to hold.
 */
export function TopBar() {
  const theme = useTheme();

  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: theme.zIndex.appBar,
        bgcolor: "background.paper",
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Box
        sx={{
          maxWidth: 1240,
          mx: "auto",
          px: { xs: 2, md: 4 },
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          component={RouterLink}
          to="/"
          sx={{ textDecoration: "none", color: "inherit" }}
        >
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: "8px",
              bgcolor: theme.custom.nileBlue600,
              display: "grid",
              placeItems: "center",
            }}
          >
            <MonitorHeartOutlinedIcon sx={{ fontSize: 18, color: "common.white" }} />
          </Box>
          <Typography
            sx={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 700,
              fontSize: "1rem",
              letterSpacing: "-0.01em",
              color: theme.custom.classroomSlate900,
            }}
          >
            Log Anomaly Detector
          </Typography>
        </Stack>

        <Chip
          size="small"
          label="local mode"
          sx={{
            bgcolor: theme.custom.campusGreen100,
            color: theme.custom.campusGreen700,
            fontSize: "0.72rem",
          }}
        />
      </Box>
    </Box>
  );
}
