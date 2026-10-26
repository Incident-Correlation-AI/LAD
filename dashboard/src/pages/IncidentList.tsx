import {
  Box,
  Button,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import DoneAllOutlinedIcon from "@mui/icons-material/DoneAllOutlined";
import NewReleasesOutlinedIcon from "@mui/icons-material/NewReleasesOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import FilterListIcon from "@mui/icons-material/FilterList";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useMemo } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";

import type { IncidentFilters, IncidentSeverity, IncidentStatus } from "../api/types";
import { SeverityChip, StatusChip } from "../components/Chips";
import { SeverityChart } from "../components/SeverityChart";
import { StatCard } from "../components/StatCard";
import { ApiErrorState, StateCard } from "../components/StateCard";
import { useIncidentBreakdown, useIncidents } from "../hooks/useIncidents";
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

/**
 * URL query params are user input: a stale or hand-edited link can carry
 * `?status=weird`. Ignoring unknown values keeps the request contract-valid and
 * the select in sync with what is actually being filtered.
 */
function parseStatus(value: string | null): IncidentStatus | undefined {
  return STATUSES.find((status) => status === value);
}

function parseSeverity(value: string | null): IncidentSeverity | undefined {
  return SEVERITIES.find((severity) => severity === value);
}

export function IncidentList() {
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const breakdown = useIncidentBreakdown();

  const activeStatus = parseStatus(searchParams.get("status"));
  const activeSeverity = parseSeverity(searchParams.get("severity"));
  const activeHost = searchParams.get("host")?.trim() ?? "";
  const sinceParam = searchParams.get("since") ?? "";
  const activeSince = SINCE_OPTIONS.some((option) => option.value === sinceParam)
    ? sinceParam
    : "";

  const filters = useMemo<IncidentFilters>(
    () => ({
      status: activeStatus,
      severity: activeSeverity,
      host: activeHost || undefined,
      time_from: sinceToIso(activeSince),
      limit: 20,
    }),
    [activeStatus, activeSeverity, activeHost, activeSince],
  );

  const query = useIncidents(filters);
  const incidents = query.data?.pages.flatMap((page) => page.items) ?? [];

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const hasFilters = Boolean(activeStatus || activeSeverity || activeHost || activeSince);

  // A tile showing "0" while the counts are still loading — or after they
  // failed — would be stating something the dashboard does not know.
  const summaryUnknown = breakdown.isLoading || breakdown.error !== null;

  const countLabel = (status: IncidentStatus) => {
    if (summaryUnknown) return "—";
    const value = breakdown.counts[status];
    return breakdown.capped[status] ? `${value}+` : String(value);
  };

  const impactLabel = () => {
    if (summaryUnknown) return "—";
    const value = breakdown.severity.critical + breakdown.severity.high;
    // Severity totals span three separately capped pages, so they can be short
    // too — do not print an exact number the API never proved.
    const anyCapped = STATUSES.some((status) => breakdown.capped[status]);
    return anyCapped ? `${value}+` : String(value);
  };

  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        gap={2}
        flexWrap="wrap"
        mb={2.5}
      >
        <Box>
          <Typography variant="h5" sx={{ color: theme.custom.classroomSlate900, mb: 0.5 }}>
            Incidents
          </Typography>
          <Typography variant="body2" sx={{ color: theme.custom.classroomSlate500 }}>
            Correlated anomalies with evidence. Scores are detector-specific
            unusualness values, not probabilities.
          </Typography>
          {breakdown.latest ? (
            <Typography variant="caption" sx={{ color: theme.custom.classroomSlate400 }}>
              Newest incident {formatRelative(breakdown.latest)}
            </Typography>
          ) : null}
        </Box>

        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => {
            void query.refetch();
            breakdown.refetch();
          }}
          disabled={query.isFetching}
        >
          {query.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </Stack>

      {/* Counts are a separate set of requests; say so when they fail rather
          than letting the tiles imply zero. */}
      {breakdown.error ? (
        <Typography
          variant="caption"
          role="status"
          sx={{ display: "block", mb: 1.5, color: theme.custom.errorRed600 }}
        >
          Summary counts are unavailable right now. The incident table below is
          unaffected.
        </Typography>
      ) : null}

      {/* Stat tiles */}
      <Grid container spacing={2} mb={2.5}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            icon={<NewReleasesOutlinedIcon fontSize="small" />}
            title="Open"
            value={countLabel("open")}
            caption="awaiting triage"
            color={theme.custom.brickTerracotta500}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            icon={<ScheduleOutlinedIcon fontSize="small" />}
            title="Acknowledged"
            value={countLabel("acknowledged")}
            caption="in progress"
            color={theme.custom.torchGold600}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            icon={<DoneAllOutlinedIcon fontSize="small" />}
            title="Resolved"
            value={countLabel("resolved")}
            caption="quiet period elapsed"
            color={theme.custom.campusGreen600}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            icon={<ErrorOutlineIcon fontSize="small" />}
            title="Critical + high"
            value={impactLabel()}
            caption="highest impact"
            color={theme.custom.errorRed500}
          />
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <FilterListIcon fontSize="small" sx={{ color: theme.custom.classroomSlate400 }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Filters
            </Typography>
          </Stack>
          <Button
            size="small"
            disabled={!hasFilters}
            onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
          >
            Clear all
          </Button>
        </Stack>

        <Grid container spacing={2}>
          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              select
              size="small"
              fullWidth
              label="Status"
              value={activeStatus ?? ""}
              onChange={(event) => updateParam("status", event.target.value)}
            >
              <MenuItem value="">Any status</MenuItem>
              {STATUSES.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              select
              size="small"
              fullWidth
              label="Severity"
              value={activeSeverity ?? ""}
              onChange={(event) => updateParam("severity", event.target.value)}
            >
              <MenuItem value="">Any severity</MenuItem>
              {SEVERITIES.map((severity) => (
                <MenuItem key={severity} value={severity}>
                  {severity}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              size="small"
              fullWidth
              label="Host"
              placeholder="web-01"
              value={searchParams.get("host") ?? ""}
              onChange={(event) => updateParam("host", event.target.value)}
            />
          </Grid>

          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              select
              size="small"
              fullWidth
              label="Window"
              value={activeSince}
              onChange={(event) => updateParam("since", event.target.value)}
            >
              {SINCE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      {query.isLoading ? (
        <StateCard
          role="status"
          title="Loading incidents"
          icon={<CircularProgress size={22} />}
          message="Querying the incidents API…"
        />
      ) : null}

      {query.isError ? (
        <ApiErrorState error={query.error} retry={() => void query.refetch()} />
      ) : null}

      {!query.isLoading && !query.isError && incidents.length === 0 ? (
        <StateCard
          title="No incidents match these filters"
          icon={<ErrorOutlineIcon fontSize="small" />}
          message="Incidents appear only after events have been ingested and correlated. An empty list is not proof that everything is healthy — check that a collector is shipping."
        />
      ) : null}

      {incidents.length > 0 ? (
        <Paper sx={{ overflow: "hidden" }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Severity</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Incident</TableCell>
                  <TableCell>Entities</TableCell>
                  <TableCell>Detector</TableCell>
                  <TableCell align="right">Score</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {incidents.map((incident) => (
                  <TableRow key={incident.incident_id} hover>
                    <TableCell>
                      <SeverityChip severity={incident.severity} />
                    </TableCell>
                    <TableCell>
                      <StatusChip status={incident.status} />
                    </TableCell>
                    <TableCell>
                      <Typography
                        component={RouterLink}
                        to={`/incidents/${encodeURIComponent(incident.incident_id)}`}
                        sx={{
                          fontFamily: "monospace",
                          fontSize: "0.8rem",
                          color: theme.custom.nileBlue700,
                          fontWeight: 600,
                          textDecoration: "none",
                          "&:hover": { textDecoration: "underline" },
                        }}
                      >
                        {incident.incident_id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {(incident.affected_entities ?? []).length > 0 ? (
                        (incident.affected_entities ?? []).map((entity, idx) => (
                          <Typography
                            key={`${entity.host}-${entity.service ?? ""}-${idx}`}
                            variant="body2"
                            sx={{ fontSize: "0.8rem" }}
                          >
                            {entity.host}
                            {entity.service ? (
                              <Box
                                component="span"
                                sx={{ color: theme.custom.classroomSlate400 }}
                              >
                                {" "}
                                / {entity.service}
                              </Box>
                            ) : null}
                          </Typography>
                        ))
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{ fontSize: "0.8rem", color: theme.custom.classroomSlate400 }}
                        >
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                        {incident.detector}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        title="Detector-specific unusualness — not a probability"
                        sx={{
                          fontFamily: "monospace",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatAnomalyScore(incident.anomaly_score)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        component="time"
                        dateTime={incident.created_at}
                        title={formatTimestamp(incident.created_at)}
                        variant="body2"
                        sx={{ fontSize: "0.8rem", color: theme.custom.classroomSlate600 }}
                      >
                        {formatRelative(incident.created_at)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              p: 1.5,
              borderTop: `1px solid ${theme.palette.divider}`,
            }}
          >
            {query.hasNextPage ? (
              <Button
                size="small"
                variant="outlined"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                {query.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            ) : (
              <Typography variant="caption" sx={{ color: theme.custom.classroomSlate400 }}>
                End of results.
              </Typography>
            )}
          </Box>
        </Paper>
      ) : null}

      {/* Chart */}
      <Paper sx={{ p: 2.5, mt: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={1}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Incidents by severity
          </Typography>
          <Typography variant="caption" sx={{ color: theme.custom.classroomSlate400 }}>
            at most 100 per status
          </Typography>
        </Stack>
        {breakdown.isLoading ? (
          <Box sx={{ display: "grid", placeItems: "center", height: 180 }}>
            <CircularProgress size={22} />
          </Box>
        ) : (
          <SeverityChart counts={breakdown.severity} />
        )}
      </Paper>
    </Box>
  );
}
