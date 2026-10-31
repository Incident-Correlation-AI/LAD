import { Box, Paper, Typography, alpha, useTheme } from "@mui/material";
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
        p: 2.5,
        height: "100%",
        display: "flex",
        alignItems: "flex-start",
        gap: 2,
        borderRadius: 0,
        bgcolor: "#0B0F0C",
        border: "1px solid rgba(122, 139, 128, 0.3)",
        transition: "border-color 0.15s ease, background-color 0.15s ease",
        "&:hover": {
          borderColor: "#E8A65D",
          bgcolor: "rgba(232, 166, 93, 0.03)",
        },
      }}
    >
      <Box
        sx={{
          width: 38,
          height: 38,
          borderRadius: 0,
          border: `1px solid ${alpha(color, 0.4)}`,
          bgcolor: alpha(color, 0.08),
          color,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            fontWeight: 700,
            fontFamily: '"JetBrains Mono", monospace',
            color: theme.custom.classroomSlate500,
            lineHeight: 1.4,
          }}
        >
          {title}
        </Typography>
        <Typography
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 700,
            fontSize: "1.65rem",
            lineHeight: 1.2,
            color: theme.custom.classroomSlate900,
            fontVariantNumeric: "tabular-nums",
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
              mt: 0.25,
            }}
          >
            {caption}
          </Typography>
        ) : null}
      </Box>
    </Paper>
  );
}
