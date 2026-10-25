import { Link, useParams } from "react-router-dom";

import { SeverityBadge, StatusPill } from "../components/Badges";
import { AuditTrail, WindowTimeline } from "../components/AuditTrail";
import { DiagnosticCheckItem } from "../components/DiagnosticCheck";
import { EvidencePanel } from "../components/EvidencePanel";
import { HypothesisCard } from "../components/HypothesisCard";
import { ErrorState, Spinner } from "../components/States";
import { useIncident, useIncidentLifecycle } from "../hooks/useIncidents";
import { formatAnomalyScore, formatTimestamp } from "../lib/format";

export function IncidentDetail() {
  const { incidentId = "" } = useParams();
  const query = useIncident(incidentId);
  const { acknowledge, resolve } = useIncidentLifecycle(incidentId);

  if (query.isLoading) return <Spinner label="Loading incident" />;
  if (query.isError) {
    return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  }

  const incident = query.data;
  if (!incident) return <ErrorState error={new Error("Incident not found")} />;

  const actionError = acknowledge.error ?? resolve.error;

  return (
    <section className="page">
      <nav className="breadcrumb">
        <Link to="/">← All incidents</Link>
      </nav>

      <header className="detail-header">
        <div>
          <h1>
            <code className="mono">{incident.incident_id}</code>
          </h1>
          <div className="header-badges">
            <SeverityBadge severity={incident.severity} />
            <StatusPill status={incident.status} />
            <span className="badge neutral mono">{incident.detector}</span>
          </div>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn"
            disabled={incident.status !== "open" || acknowledge.isPending}
            onClick={() => acknowledge.mutate()}
          >
            {acknowledge.isPending ? "Acknowledging…" : "Acknowledge"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={incident.status === "resolved" || resolve.isPending}
            onClick={() => resolve.mutate()}
          >
            {resolve.isPending ? "Resolving…" : "Resolve"}
          </button>
        </div>
      </header>

      {actionError ? (
        <div className="inline-error" role="alert">
          Action failed: {actionError instanceof Error ? actionError.message : String(actionError)}
        </div>
      ) : null}

      <div className="grid">
        <div className="card">
          <h2>Detection</h2>
          <dl className="meta">
            <div>
              <dt>Anomaly score</dt>
              <dd>
                {formatAnomalyScore(incident.anomaly_score)}
                <span className="hint">detector-specific unusualness — not a probability</span>
              </dd>
            </div>
            <div>
              <dt>Severity</dt>
              <dd>
                {incident.severity}
                <span className="hint">estimated operational impact (rule-based)</span>
              </dd>
            </div>
            <div>
              <dt>Detector</dt>
              <dd className="mono">{incident.detector}</dd>
            </div>
            {incident.model_versions && Object.keys(incident.model_versions).length ? (
              <div>
                <dt>Model versions</dt>
                <dd className="mono">
                  {Object.entries(incident.model_versions)
                    .map(([name, version]) => `${name} ${version}`)
                    .join(" · ")}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Created</dt>
              <dd>{formatTimestamp(incident.created_at)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatTimestamp(incident.updated_at)}</dd>
            </div>
            <div>
              <dt>Schema</dt>
              <dd className="mono">{incident.schema_version}</dd>
            </div>
          </dl>
        </div>

        <div className="card">
          <h2>Affected entities</h2>
          <ul className="entity-list">
            {incident.affected_entities.map((entity) => (
              <li key={`${entity.host}-${entity.service ?? ""}-${entity.source ?? ""}`}>
                <strong>{entity.host}</strong>
                {entity.service ? <span className="muted"> · {entity.service}</span> : null}
                {entity.source ? <span className="muted"> · {entity.source}</span> : null}
              </li>
            ))}
          </ul>

          <h2 className="spaced">Observation windows</h2>
          <WindowTimeline windows={incident.windows ?? []} />
        </div>
      </div>

      <div className="card">
        <h2>Evidence</h2>
        <EvidencePanel evidence={incident.evidence} />
      </div>

      <div className="card">
        <h2>
          Hypotheses <span className="count">{incident.hypotheses.length}</span>
        </h2>
        <p className="muted">
          Confidence describes how strongly the evidence supports an explanation.
          It is not a probability, and “unknown” is a valid outcome.
        </p>
        {incident.hypotheses.length ? (
          <div className="hypothesis-list">
            {incident.hypotheses.map((hypothesis, index) => (
              <HypothesisCard key={`${hypothesis.statement}-${index}`} hypothesis={hypothesis} />
            ))}
          </div>
        ) : (
          <p className="muted">No hypothesis recorded for this incident.</p>
        )}
      </div>

      <div className="card">
        <h2>
          Diagnostic checks <span className="count">{incident.diagnostic_checks.length}</span>
        </h2>
        <p className="muted">
          Recommendations for a human to follow. Nothing here is executed
          automatically — this product never remediates.
        </p>
        {incident.diagnostic_checks.length ? (
          <ul className="check-list">
            {incident.diagnostic_checks.map((check, index) => (
              <DiagnosticCheckItem key={`${check.instruction}-${index}`} check={check} />
            ))}
          </ul>
        ) : (
          <p className="muted">No checks suggested.</p>
        )}
      </div>

      <div className="card">
        <h2>Audit trail</h2>
        <AuditTrail entries={incident.audit} />
      </div>
    </section>
  );
}
