import { Box, Chip, Stack, Typography, useTheme } from "@mui/material";

import type { Hypothesis } from "../api/types";
import { ConfidenceChip } from "./Chips";

export function HypothesisCard({ hypothesis }: { hypothesis: Hypothesis }) {
  const theme = useTheme();
  const isUnknown = hypothesis.confidence === "unknown";

  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: 0,
        bgcolor: "#0B0F0C",
        border: `1px solid ${isUnknown ? "rgba(122, 139, 128, 0.4)" : "rgba(122, 139, 128, 0.35)"}`,
        borderStyle: isUnknown ? "dashed" : "solid",
        fontFamily: '"JetBrains Mono", monospace',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
        <Typography
          sx={{
            fontWeight: 600,
            color: theme.custom.classroomSlate900,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "0.9rem",
            lineHeight: 1.5,
          }}
        >
          {hypothesis.statement}
        </Typography>
        <ConfidenceChip confidence={hypothesis.confidence} />
      </Stack>

      <Stack direction="row" spacing={3} mt={2}>
        <Box>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 700,
              fontFamily: '"JetBrains Mono", monospace',
              color: theme.custom.classroomSlate500,
            }}
          >
            Supporting
          </Typography>
          <Typography
            sx={{
              fontWeight: 700,
              fontFamily: '"JetBrains Mono", monospace',
              color: theme.custom.campusGreen600,
              fontSize: "1.1rem",
            }}
          >
            {(hypothesis.supporting_event_ids ?? []).length}
          </Typography>
        </Box>
        <Box>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 700,
              fontFamily: '"JetBrains Mono", monospace',
              color: theme.custom.classroomSlate500,
            }}
          >
            Contradicting
          </Typography>
          <Typography
            sx={{
              fontWeight: 700,
              fontFamily: '"JetBrains Mono", monospace',
              color: theme.custom.brickTerracotta500,
              fontSize: "1.1rem",
            }}
          >
            {(hypothesis.contradicting_event_ids ?? []).length}
          </Typography>
        </Box>
      </Stack>

      <Typography
        variant="caption"
        sx={{
          display: "block",
          mt: 2,
          mb: 0.5,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontFamily: '"JetBrains Mono", monospace',
          color: theme.custom.classroomSlate500,
        }}
      >
        Missing evidence
      </Typography>
      {(hypothesis.missing_evidence ?? []).length ? (
        <Box component="ul" sx={{ m: 0, pl: 2.5, fontFamily: '"JetBrains Mono", monospace' }}>
          {(hypothesis.missing_evidence ?? []).map((item) => (
            <Box
              component="li"
              key={item}
              sx={{
                color: theme.custom.classroomSlate500,
                fontSize: "0.82rem",
                mb: 0.5,
              }}
            >
              {item}
            </Box>
          ))}
        </Box>
      ) : (
        <Typography
          variant="body2"
          sx={{
            color: theme.custom.classroomSlate500,
            fontStyle: "italic",
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "0.8rem",
          }}
        >
          None identified.
        </Typography>
      )}

      {isUnknown ? (
        <Chip
          size="small"
          variant="outlined"
          label="An unknown hypothesis is a valid result — evidence does not decide between explanations."
          sx={{
            mt: 2,
            borderRadius: 0,
            borderStyle: "dashed",
            borderColor: "rgba(122, 139, 128, 0.4)",
            bgcolor: "rgba(122, 139, 128, 0.06)",
            color: theme.custom.classroomSlate500,
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 500,
            fontSize: "0.72rem",
            height: "auto",
            "& .MuiChip-label": { py: 0.75, whiteSpace: "normal" },
          }}
        />
      ) : null}
    </Box>
  );
}
