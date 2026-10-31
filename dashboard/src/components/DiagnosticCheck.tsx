import { Box, Chip, Stack, Typography, useTheme } from "@mui/material";

import type { DiagnosticCheck } from "../api/types";

export function DiagnosticCheckItem({ check }: { check: DiagnosticCheck }) {
  const theme = useTheme();

  return (
    <Box
      component="li"
      sx={{
        p: 2,
        borderRadius: 0,
        bgcolor: "#111613",
        border: "1px solid rgba(122, 139, 128, 0.25)",
        listStyle: "none",
        fontFamily: '"JetBrains Mono", monospace',
      }}
    >
      <Typography
        variant="body2"
        sx={{
          mb: 1.25,
          color: theme.custom.classroomSlate900,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "0.85rem",
        }}
      >
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
            borderRadius: 0,
            borderColor: "rgba(232, 166, 93, 0.4)",
            bgcolor: "rgba(232, 166, 93, 0.08)",
            color: "#E8A65D",
            fontWeight: 600,
            fontSize: "0.7rem",
            fontFamily: '"JetBrains Mono", monospace',
          }}
        />
        {check.evidence_links.length ? (
          <Typography
            variant="caption"
            sx={{
              color: theme.custom.classroomSlate500,
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.75rem",
            }}
          >
            linked evidence:{" "}
            <Box component="span" sx={{ fontFamily: "monospace", color: "#D7E0D9" }}>
              {check.evidence_links.join(", ")}
            </Box>
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}
