import { Box, Chip, Stack, Typography, useTheme } from "@mui/material";

import type { Hypothesis } from "../api/types";
import { ConfidenceChip } from "./Chips";

export function HypothesisCard({ hypothesis }: { hypothesis: Hypothesis }) {
  const theme = useTheme();
  const isUnknown = hypothesis.confidence === "unknown";

  return (
    <Box
      sx={{
        px: { xs: 2.5, md: 3.5 },
        py: { xs: 2.5, md: 3.25 },
        borderRadius: 0,
        bgcolor: "#0B0F0C",
        border: `1px solid ${isUnknown ? "rgba(162, 181, 168, 0.5)" : "rgba(162, 181, 168, 0.45)"}`,
        borderStyle: isUnknown ? "dashed" : "solid",
        fontFamily: '"JetBrains Mono", monospace',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
        <Typography
          sx={{
            fontWeight: 700,
            color: "#FFFFFF",
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "1.02rem",
            lineHeight: 1.6,
          }}
        >
          {hypothesis.statement}
        </Typography>
        <ConfidenceChip confidence={hypothesis.confidence} />
      </Stack>

      <Stack direction="row" spacing={1.5} mt={2.5} flexWrap="wrap">
        <Box
          sx={{
            px: 2.25,
            py: 1.25,
            bgcolor: "#0F1512",
            border: "1px solid rgba(162, 181, 168, 0.4)",
            minWidth: 150,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              display: "block",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 800,
              fontFamily: '"JetBrains Mono", monospace',
              color: "#C7D2CC",
              fontSize: "0.78rem",
            }}
          >
            Supporting
          </Typography>
          <Typography
            sx={{
              fontWeight: 800,
              fontFamily: '"JetBrains Mono", monospace',
              color: theme.custom.campusGreen600,
              fontSize: "1.5rem",
              lineHeight: 1.2,
              mt: 0.25,
            }}
          >
            {(hypothesis.supporting_event_ids ?? []).length}
          </Typography>
        </Box>
        <Box
          sx={{
            px: 2.25,
            py: 1.25,
            bgcolor: "#0F1512",
            border: "1px solid rgba(162, 181, 168, 0.4)",
            minWidth: 150,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              display: "block",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 800,
              fontFamily: '"JetBrains Mono", monospace',
              color: "#C7D2CC",
              fontSize: "0.78rem",
            }}
          >
            Contradicting
          </Typography>
          <Typography
            sx={{
              fontWeight: 800,
              fontFamily: '"JetBrains Mono", monospace',
              color: theme.custom.brickTerracotta500,
              fontSize: "1.5rem",
              lineHeight: 1.2,
              mt: 0.25,
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
          mt: 2.5,
          mb: 1,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "0.85rem",
          color: "#D2DFD7",
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
                color: "#BACBC1",
                fontSize: "0.92rem",
                mb: 0.75,
                lineHeight: 1.5,
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
            color: "#BACBC1",
            fontStyle: "italic",
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "0.88rem",
            py: 0.5,
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
            mt: 2.5,
            borderRadius: 0,
            borderStyle: "dashed",
            borderColor: "rgba(162, 181, 168, 0.45)",
            bgcolor: "rgba(162, 181, 168, 0.08)",
            color: "#BACBC1",
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 600,
            fontSize: "0.82rem",
            height: "auto",
            "& .MuiChip-label": { py: 1, px: 1.5, whiteSpace: "normal" },
          }}
        />
      ) : null}
    </Box>
  );
}
