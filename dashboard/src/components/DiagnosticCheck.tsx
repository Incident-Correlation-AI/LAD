import { Box, Chip, Stack, Typography, alpha, useTheme } from "@mui/material";

import type { DiagnosticCheck } from "../api/types";

export function DiagnosticCheckItem({ check }: { check: DiagnosticCheck }) {
  const theme = useTheme();

  return (
    <Box
      component="li"
      sx={{
        p: 2,
        borderRadius: "10px",
        bgcolor: alpha(theme.custom.classroomSlate500, 0.03),
        border: `1px solid ${theme.palette.divider}`,
        listStyle: "none",
      }}
    >
      <Typography variant="body2" sx={{ mb: 1.25, color: theme.custom.classroomSlate800 }}>
        {check.instruction}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        {/* `executes` is structurally false in the contract: nothing here runs
            anything on the monitored host. */}
        <Chip
          size="small"
          variant="outlined"
          label={check.executes ? "executes" : "not executed automatically"}
          sx={{
            borderColor: alpha(theme.custom.nileBlue600, 0.3),
            bgcolor: alpha(theme.custom.nileBlue600, 0.07),
            color: theme.custom.nileBlue800,
            fontWeight: 600,
            fontSize: "0.7rem",
          }}
        />
        {check.evidence_links.length ? (
          <Typography variant="caption" sx={{ color: theme.custom.classroomSlate400 }}>
            linked evidence:{" "}
            <Box component="span" sx={{ fontFamily: "monospace" }}>
              {check.evidence_links.join(", ")}
            </Box>
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}
