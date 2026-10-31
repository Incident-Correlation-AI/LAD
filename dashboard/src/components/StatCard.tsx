import { Box, Paper, Typography, useTheme } from "@mui/material";
import type { ReactNode } from "react";

/**
 * Compact terminal telemetry stat tile:
 * Dark terminal surface, sharp 1px border, monospace typography.
 */
export function StatCard({
  icon,
  title,
  value,
  caption,
  color,
}: {
  icon: ReactNode;
  title: string;
  value: string | number;
  caption?: string;
  color: string;
}) {
  const theme = useTheme();

  return (
    <Paper
      sx={{
        px: { xs: 2.5, md: 3 },
        py: { xs: 2.25, md: 2.75 },
        height: "100%",
        display: "flex",
        alignItems: "flex-start",
        gap: 2,
        borderRadius: 0,
        bgcolor: "#0B0F0C",
        border: "1px solid rgba(162, 181, 168, 0.45)",
        transition: "border-color 0.15s ease, background-color 0.15s ease",
        "&:hover": {
          borderColor: "#E8A65D",
          bgcolor: "rgba(232, 166, 93, 0.05)",
        },
      }}
    >
      <Box
        sx={{
          width: 46,
          height: 46,
          borderRadius: 0,
          border: "1px solid rgba(162, 181, 168, 0.5)",
          bgcolor: "rgba(15, 21, 18, 0.9)",
          color,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontWeight: 800,
            fontSize: "0.8rem",
            fontFamily: '"JetBrains Mono", monospace',
            color: "#C7D2CC",
            lineHeight: 1.4,
          }}
        >
          {title}
        </Typography>
        <Typography
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 800,
            fontSize: "2.25rem",
            lineHeight: 1.15,
            color: "#FFFFFF",
            fontVariantNumeric: "tabular-nums",
            my: 0.25,
          }}
        >
          {typeof value === "number" ? value.toLocaleString() : value}
        </Typography>
        {caption ? (
          <Typography
            variant="caption"
            sx={{
              display: "block",
              fontFamily: '"JetBrains Mono", monospace',
              color: theme.custom.classroomSlate500,
              fontSize: "0.82rem",
              mt: 0.35,
            }}
          >
            {caption}
          </Typography>
        ) : null}
      </Box>
    </Paper>
  );
}
