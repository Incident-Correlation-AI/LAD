import { Avatar, Box, Paper, Typography, alpha, useTheme } from "@mui/material";
import type { ReactNode } from "react";

/**
 * Compact stat tile: white surface, hairline border, tinted icon. No gradients
 * or accent spines — the number is the thing worth looking at.
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
        transition: "box-shadow 0.18s ease, border-color 0.18s ease",
        "&:hover": {
          boxShadow: "0 4px 12px rgba(16, 24, 40, 0.08)",
          borderColor: alpha(color, 0.4),
        },
      }}
    >
      <Avatar
        sx={{
          width: 40,
          height: 40,
          borderRadius: "10px",
          bgcolor: alpha(color, 0.12),
          color,
        }}
      >
        {icon}
      </Avatar>

      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            fontWeight: 700,
            color: theme.custom.classroomSlate500,
            lineHeight: 1.4,
          }}
        >
          {title}
        </Typography>
        <Typography
          sx={{
            fontFamily: '"Space Grotesk", sans-serif',
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
          <Typography variant="caption" sx={{ color: theme.custom.classroomSlate400 }}>
            {caption}
          </Typography>
        ) : null}
      </Box>
    </Paper>
  );
}
