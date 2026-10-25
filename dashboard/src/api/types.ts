/**
 * TypeScript mirrors of `contracts/schemas/incident.schema.json` and
 * `contracts/openapi.yaml`.
 *
 * These are hand-written on purpose: the shapes are small and stable, and a
 * hand-written mirror is easier to read than a generated bundle. If the schema
 * changes, this file changes with it — `tests/contract` on the Python side
 * remains the source of truth for what is valid.
 *
 * Honesty rules encoded in the types:
 *  - `anomaly_score` is a detector-specific number. It is NOT a probability.
 *  - `severity` is a separate, rule-based impact estimate.
 *  - `hypotheses[].confidence` is strength of support, NOT a probability, and
 *    `unknown` is a legitimate value.
 *  - `diagnostic_checks[].executes` is structurally `false`: nothing here runs.
 */

export type IncidentStatus = "open" | "acknowledged" | "resolved";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type HypothesisConfidence = "low" | "medium" | "high" | "unknown";

export interface AffectedEntity {
  host: string;
  service?: string | null;
  source?: string | null;
}

export interface IncidentWindow {
  start: string;
  end: string;
}

export interface Evidence {
  supporting_event_ids: string[];
  contradicting_event_ids: string[];
  redacted_refs?: string[];
}

export interface Hypothesis {
  statement: string;
  confidence: HypothesisConfidence;
  supporting_event_ids: string[];
  contradicting_event_ids: string[];
  missing_evidence: string[];
}

export interface DiagnosticCheck {
  instruction: string;
  evidence_links: string[];
  executes: false;
}

export interface AuditEntry {
  action: "acknowledged" | "resolved" | "reopened";
  actor: string;
  at: string;
  note?: string | null;
}

export interface Incident {
  incident_id: string;
  schema_version: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  affected_entities: AffectedEntity[];
  anomaly_score: number;
  detector: string;
  model_versions?: Record<string, string>;
  windows?: IncidentWindow[];
  evidence: Evidence;
  hypotheses: Hypothesis[];
  diagnostic_checks: DiagnosticCheck[];
  created_at: string;
  updated_at: string;
  audit: AuditEntry[];
}

export interface IncidentList {
  items: Incident[];
  next_cursor: string | null;
}

/** Filters accepted by `GET /api/v1/incidents`. */
export interface IncidentFilters {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  host?: string;
  time_from?: string;
  time_to?: string;
  limit?: number;
}
