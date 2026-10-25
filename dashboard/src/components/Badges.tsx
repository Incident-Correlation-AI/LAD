import type {
  HypothesisConfidence,
  IncidentSeverity,
  IncidentStatus,
} from "../api/types";

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  return (
    <span className={`badge severity severity-${severity}`} title="Estimated operational impact (rule-based)">
      {severity}
    </span>
  );
}

export function StatusPill({ status }: { status: IncidentStatus }) {
  return <span className={`badge status status-${status}`}>{status}</span>;
}

export function ConfidenceBadge({ confidence }: { confidence: HypothesisConfidence }) {
  // "unknown" is a first-class outcome, not a failure state.
  const label = confidence === "unknown" ? "unknown" : `${confidence} support`;
  return (
    <span className={`badge confidence confidence-${confidence}`} title="Strength of support — not a probability">
      {label}
    </span>
  );
}
