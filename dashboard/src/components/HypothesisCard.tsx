import { Box, Chip, Stack, Typography, alpha, useTheme } from "@mui/material";

import type { Hypothesis } from "../api/types";
import { ConfidenceChip } from "./Chips";

export function HypothesisCard({ hypothesis }: { hypothesis: Hypothesis }) {
  const theme = useTheme();
  const isUnknown = hypothesis.confidence === "unknown";

  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: "10px",
        bgcolor: alpha(theme.custom.classroomSlate500, 0.03),
        border: `1px solid ${theme.palette.divider}`,
        borderStyle: isUnknown ? "dashed" : "solid",
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
        <Typography sx={{ fontWeight: 600, color: theme.custom.classroomSlate800 }}>
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
              color: theme.custom.classroomSlate400,
            }}
          >
            Supporting
          </Typography>
          <Typography sx={{ fontWeight: 700, color: theme.custom.campusGreen600 }}>
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
              color: theme.custom.classroomSlate400,
            }}
          >
            Contradicting
          </Typography>
          <Typography sx={{ fontWeight: 700, color: theme.custom.brickTerracotta500 }}>
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
          color: theme.custom.classroomSlate400,
        }}
      >
        Missing evidence
      </Typography>
      {(hypothesis.missing_evidence ?? []).length ? (
        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
          {(hypothesis.missing_evidence ?? []).map((item) => (
            <Typography component="li" variant="body2" key={item} sx={{ mb: 0.25 }}>
              {item}
            </Typography>
          ))}
        </Box>
      ) : (
        <Typography variant="body2" sx={{ color: theme.custom.classroomSlate400 }}>
          No gaps declared.
        </Typography>
      )}

      {isUnknown ? (
        <Chip
          size="small"
          label="An unknown hypothesis is a valid result — evidence does not decide between explanations."
          sx={{
            mt: 2,
            bgcolor: alpha(theme.custom.classroomSlate500, 0.06),
            color: theme.custom.classroomSlate600,
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
