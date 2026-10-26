import { Chip, useTheme, alpha } from "@mui/material";
import type { ChipProps } from "@mui/material";
import type { Theme } from "@mui/material/styles";

import type {
  HypothesisConfidence,
  IncidentSeverity,
  IncidentStatus,
} from "../api/types";

/**
 * Severity is estimated operational impact (rule-based). It is intentionally
 * NOT derived from `anomaly_score` — they are separate concepts and are shown
 * separately everywhere.
 */
export function severityColor(severity: IncidentSeverity, theme: Theme): string {
  switch (severity) {
    case "critical":
      return theme.custom.errorRed500;
    case "high":
      return theme.custom.brickTerracotta500;
    case "medium":
      return theme.custom.torchGold600;
    case "low":
      return theme.custom.nileBlue500;
    default:
      return theme.custom.classroomSlate500;
  }
}

export function statusColor(status: IncidentStatus, theme: Theme): string {
  switch (status) {
    case "open":
      return theme.custom.brickTerracotta500;
    case "acknowledged":
      return theme.custom.torchGold600;
    case "resolved":
      return theme.custom.campusGreen600;
    default:
      return theme.custom.classroomSlate500;
  }
}

function TintedChip({ tint, ...props }: Omit<ChipProps, "color"> & { tint: string }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      {...props}
      sx={{
        fontWeight: 700,
        fontSize: "0.72rem",
        letterSpacing: "0.02em",
        bgcolor: alpha(tint, 0.1),
        color: tint,
        borderColor: alpha(tint, 0.35),
        ...props.sx,
      }}
    />
  );
}

export function SeverityChip({ severity }: { severity: IncidentSeverity }) {
  const theme = useTheme();
  return (
    <TintedChip
      tint={severityColor(severity, theme)}
      label={severity}
      title="Estimated operational impact (rule-based)"
    />
  );
}

export function StatusChip({ status }: { status: IncidentStatus }) {
  const theme = useTheme();
  return <TintedChip tint={statusColor(status, theme)} label={status} />;
}

export function ConfidenceChip({ confidence }: { confidence: HypothesisConfidence }) {
  const theme = useTheme();
  // "unknown" is a first-class outcome, so it gets a neutral dashed chip
  // rather than an error colour.
  if (confidence === "unknown") {
    return (
      <Chip
        size="small"
        variant="outlined"
        label="unknown"
        title="Strength of support — not a probability"
        sx={{
          fontWeight: 700,
          fontSize: "0.72rem",
          borderStyle: "dashed",
          borderColor: theme.custom.classroomSlate300,
          color: theme.custom.classroomSlate600,
        }}
      />
    );
  }
  const tint =
    confidence === "high"
      ? theme.custom.campusGreen600
      : confidence === "medium"
        ? theme.custom.torchGold600
        : theme.custom.classroomSlate500;
  return (
    <TintedChip
      tint={tint}
      label={`${confidence} support`}
      title="Strength of support — not a probability"
    />
  );
}
