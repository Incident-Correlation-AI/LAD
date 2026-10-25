import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import type { IncidentFilters, IncidentSeverity, IncidentStatus } from "../api/types";
import { SeverityBadge, StatusPill } from "../components/Badges";
import { EmptyState, ErrorState, Spinner } from "../components/States";
import { useIncidents } from "../hooks/useIncidents";
import { formatAnomalyScore, formatRelative, formatTimestamp } from "../lib/format";

const STATUSES: IncidentStatus[] = ["open", "acknowledged", "resolved"];
const SEVERITIES: IncidentSeverity[] = ["low", "medium", "high", "critical"];
const SINCE_OPTIONS = [
  { value: "", label: "Any time" },
  { value: "1", label: "Last hour" },
  { value: "24", label: "Last 24 hours" },
  { value: "168", label: "Last 7 days" },
];

function sinceToIso(hours: string | null): string | undefined {
  if (!hours) return undefined;
  const parsed = Number(hours);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return new Date(Date.now() - parsed * 3600 * 1000).toISOString();
}

export function IncidentList() {
  // Filter state lives in the URL so links are shareable and back/forward work.
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<IncidentFilters>(
    () => ({
      status: (searchParams.get("status") as IncidentStatus | null) ?? undefined,
      severity: (searchParams.get("severity") as IncidentSeverity | null) ?? undefined,
      host: searchParams.get("host")?.trim() || undefined,
      time_from: sinceToIso(searchParams.get("since")),
      limit: 20,
    }),
    [searchParams],
  );

  const query = useIncidents(filters);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const incidents = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Incidents</h1>
          <p className="muted">
            Correlated anomalies with evidence. Scores are detector-specific
            unusualness values, not probabilities.
          </p>
        </div>
        {query.isFetching && !query.isLoading ? <Spinner label="Refreshing" /> : null}
      </header>

      <div className="filters" role="group" aria-label="Filters">
        <label>
          <span>Status</span>
          <select
            value={searchParams.get("status") ?? ""}
            onChange={(event) => updateParam("status", event.target.value)}
          >
            <option value="">Any status</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Severity</span>
          <select
            value={searchParams.get("severity") ?? ""}
            onChange={(event) => updateParam("severity", event.target.value)}
          >
            <option value="">Any severity</option>
            {SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Host</span>
          <input
            type="search"
            placeholder="web-01"
            defaultValue={searchParams.get("host") ?? ""}
            onChange={(event) => updateParam("host", event.target.value)}
          />
        </label>

        <label>
          <span>Window</span>
          <select
            value={searchParams.get("since") ?? ""}
            onChange={(event) => updateParam("since", event.target.value)}
          >
            {SINCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {query.isLoading ? <Spinner label="Loading incidents" /> : null}

      {query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : null}

      {!query.isLoading && !query.isError && incidents.length === 0 ? (
        <EmptyState
          title="No incidents match these filters."
          hint="Incidents appear only after events have been ingested and correlated. An empty list is not proof that everything is healthy — check that a collector is shipping."
        />
      ) : null}

      {incidents.length > 0 ? (
        <>
          <table className="incident-table">
            <thead>
              <tr>
                <th scope="col">Severity</th>
                <th scope="col">Status</th>
                <th scope="col">Incident</th>
                <th scope="col">Entities</th>
                <th scope="col">Detector</th>
                <th scope="col" className="num">
                  Anomaly score
                </th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.incident_id}>
                  <td>
                    <SeverityBadge severity={incident.severity} />
                  </td>
                  <td>
                    <StatusPill status={incident.status} />
                  </td>
                  <td>
                    <Link to={`/incidents/${encodeURIComponent(incident.incident_id)}`}>
                      <code className="mono">{incident.incident_id}</code>
                    </Link>
                  </td>
                  <td>
                    {incident.affected_entities.map((entity) => (
                      <span className="entity" key={`${entity.host}-${entity.service ?? ""}`}>
                        {entity.host}
                        {entity.service ? <span className="muted"> / {entity.service}</span> : null}
                      </span>
                    ))}
                  </td>
                  <td>
                    <span className="mono small">{incident.detector}</span>
                  </td>
                  <td className="num">
                    <span title="Detector-specific unusualness — not a probability">
                      {formatAnomalyScore(incident.anomaly_score)}
                    </span>
                  </td>
                  <td>
                    <time dateTime={incident.created_at} title={formatTimestamp(incident.created_at)}>
                      {formatRelative(incident.created_at)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            {query.hasNextPage ? (
              <button
                type="button"
                className="btn"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                {query.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            ) : (
              <span className="muted">End of results.</span>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
