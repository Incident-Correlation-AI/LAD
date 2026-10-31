import { Box, Chip, Stack, Typography } from "@mui/material";

import type { DiagnosticCheck } from "../api/types";

export function DiagnosticCheckItem({ check }: { check: DiagnosticCheck }) {
  return (
    <Box
      component="li"
      sx={{
        px: { xs: 2, md: 2.5 },
        py: 2.25,
        borderRadius: 0,
        bgcolor: "#0F1512",
        border: "1px solid rgba(162, 181, 168, 0.4)",
        listStyle: "none",
        fontFamily: '"JetBrains Mono", monospace',
      }}
    >
      <Typography
        variant="body2"
        sx={{
          mb: 1.75,
          color: "#FFFFFF",
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "0.98rem",
          lineHeight: 1.7,
        }}
      >
        {check.instruction}
      </Typography>
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        {/* `executes` is structurally false in the contract: nothing here runs
            anything on the monitored host. */}
        <Chip
          size="small"
          variant="outlined"
          label={check.executes ? "executes" : "not executed automatically"}
          sx={{
            borderRadius: 0,
            borderColor: "rgba(232, 166, 93, 0.55)",
            bgcolor: "rgba(232, 166, 93, 0.08)",
            color: "#E8A65D",
            fontWeight: 700,
            fontSize: "0.78rem",
            letterSpacing: "0.03em",
            fontFamily: '"JetBrains Mono", monospace',
          }}
        />
        {check.evidence_links.length ? (
          <Typography
            variant="caption"
            sx={{
              color: "#BACBC1",
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.82rem",
            }}
          >
            linked evidence:{" "}
            <Box component="span" sx={{ fontFamily: "monospace", color: "#FFFFFF", fontWeight: 700 }}>
              {check.evidence_links.join(", ")}
            </Box>
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}
