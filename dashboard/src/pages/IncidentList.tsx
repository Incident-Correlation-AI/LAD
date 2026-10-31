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
      {/* Terminal Section Header */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        gap={2}
        flexWrap="wrap"
        mb={3}
      >
        <Box>
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.92rem",
              fontWeight: 600,
              color: "#A2B5A8",
              mb: 0.5,
            }}
          >
            $ ./lad-telemetry --overview
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: 700,
              fontSize: "1.65rem",
              color: theme.custom.classroomSlate900,
              letterSpacing: "-0.01em",
              mb: 0.75,
            }}
          >
            Incidents
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              color: theme.custom.classroomSlate500,
              fontSize: "0.92rem",
              lineHeight: 1.55,
            }}
          >
            Correlated anomalies with evidence. Scores are detector-specific
            unusualness values, not probabilities.
          </Typography>
          {breakdown.latest ? (
            <Typography
              variant="caption"
              sx={{
                display: "block",
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#E8A65D",
                mt: 0.75,
              }}
            >
              Newest incident {formatRelative(breakdown.latest)}
            </Typography>
          ) : null}
        </Box>

        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon sx={{ fontSize: 18 }} />}
          onClick={() => {
            void query.refetch();
            breakdown.refetch();
          }}
          disabled={query.isFetching}
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "0.88rem",
            fontWeight: 600,
            borderRadius: 0,
            px: 2,
            py: 0.8,
            color: theme.custom.classroomSlate900,
            borderColor: "rgba(162, 181, 168, 0.4)",
            "&:hover": {
              borderColor: "#E8A65D",
              color: "#E8A65D",
              bgcolor: "rgba(232, 166, 93, 0.08)",
            },
          }}
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
          sx={{
            display: "block",
            mb: 2,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "0.88rem",
            color: theme.custom.errorRed500,
          }}
        >
          Summary counts are unavailable right now. The incident table below is
          unaffected.
        </Typography>
      ) : null}

      {/* Stat tiles */}
      <Grid container spacing={2.5} mb={3}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            icon={<NewReleasesOutlinedIcon sx={{ fontSize: 22 }} />}
            title="Open"
            value={countLabel("open")}
            caption="awaiting triage"
            color={theme.custom.brickTerracotta500}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            icon={<ScheduleOutlinedIcon sx={{ fontSize: 22 }} />}
            title="Acknowledged"
            value={countLabel("acknowledged")}
            caption="in progress"
            color={theme.custom.torchGold600}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            icon={<DoneAllOutlinedIcon sx={{ fontSize: 22 }} />}
            title="Resolved"
            value={countLabel("resolved")}
            caption="quiet period elapsed"
            color={theme.custom.campusGreen600}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            icon={<ErrorOutlineIcon sx={{ fontSize: 22 }} />}
            title="Critical + high"
            value={impactLabel()}
            caption="highest impact"
            color={theme.custom.errorRed500}
          />
        </Grid>
      </Grid>

      {/* Telemetry Chart: Incidents by severity (Placed before filters and table) */}
      <Paper
        sx={{
          px: { xs: 2.5, md: 3.5 },
          py: { xs: 2.5, md: 3 },
          mb: 3,
          bgcolor: "#0B0F0C",
          border: "1px solid rgba(122, 139, 128, 0.35)",
          borderRadius: 0,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={2} flexWrap="wrap" gap={1}>
          <Box>
            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "0.88rem",
                color: "#A2B5A8",
                mb: 0.25,
                fontWeight: 600,
              }}
            >
              $ ./lad-histogram --by-severity
            </Typography>
            <Typography
              variant="subtitle2"
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 700,
                fontSize: "1.05rem",
                letterSpacing: "-0.01em",
                color: theme.custom.classroomSlate900,
              }}
            >
              Incidents by severity
            </Typography>
          </Box>
          <Typography
            variant="caption"
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              color: theme.custom.classroomSlate500,
              fontSize: "0.82rem",
            }}
          >
            at most 100 per status
          </Typography>
        </Stack>
        {breakdown.isLoading ? (
          <Box sx={{ display: "grid", placeItems: "center", height: 180 }}>
            <CircularProgress size={24} sx={{ color: "#E8A65D" }} />
          </Box>
        ) : (
          <SeverityChart counts={breakdown.severity} />
        )}
      </Paper>

      {/* Filters */}
      <Paper
        sx={{
          px: { xs: 2.5, md: 3.5 },
          py: { xs: 2.25, md: 2.5 },
          mb: 3,
          bgcolor: "#0B0F0C",
          border: "1px solid rgba(122, 139, 128, 0.35)",
          borderRadius: 0,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <FilterListIcon sx={{ fontSize: 18, color: theme.custom.classroomSlate500 }} />
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "0.88rem",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#A2B5A8",
              }}
            >
              $ filter-query
            </Typography>
          </Stack>
          <Button
            size="small"
            disabled={!hasFilters}
            onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.82rem",
              fontWeight: 600,
              borderRadius: 0,
              color: hasFilters ? "#E8A65D" : theme.custom.classroomSlate500,
              borderColor: "transparent",
            }}
          >
            [ Clear all ]
          </Button>
        </Stack>

        <Grid container spacing={2.5}>
          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              select
              size="small"
              fullWidth
              label="Status"
              value={activeStatus ?? ""}
              onChange={(event) => updateParam("status", event.target.value)}
              slotProps={{
                inputLabel: {
                  sx: { fontFamily: '"JetBrains Mono", monospace', fontSize: "0.85rem", color: theme.custom.classroomSlate500 },
                },
              }}
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
              slotProps={{
                inputLabel: {
                  sx: { fontFamily: '"JetBrains Mono", monospace', fontSize: "0.85rem", color: theme.custom.classroomSlate500 },
                },
              }}
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
              slotProps={{
                inputLabel: {
                  sx: { fontFamily: '"JetBrains Mono", monospace', fontSize: "0.85rem", color: theme.custom.classroomSlate500 },
                },
                htmlInput: {
                  sx: { fontFamily: '"JetBrains Mono", monospace', fontSize: "0.92rem" },
                },
              }}
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
              slotProps={{
                inputLabel: {
                  sx: { fontFamily: '"JetBrains Mono", monospace', fontSize: "0.85rem", color: theme.custom.classroomSlate500 },
                },
              }}
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
          icon={<CircularProgress size={22} sx={{ color: "#E8A65D" }} />}
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
        <Paper
          sx={{
            overflow: "hidden",
            bgcolor: "#0B0F0C",
            border: "1px solid rgba(122, 139, 128, 0.35)",
            borderRadius: 0,
          }}
        >
          {/* Terminal Table Header Bar */}
          <Box
            sx={{
              px: { xs: 2.5, md: 3.5 },
              py: 1.5,
              borderBottom: "1px solid rgba(122, 139, 128, 0.25)",
              bgcolor: "#111613",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 1,
            }}
          >
            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "0.88rem",
                color: "#A2B5A8",
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}
            >
              $ ./lad-table --incidents
            </Typography>
            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "0.82rem",
                fontWeight: 600,
                color: theme.custom.classroomSlate500,
              }}
            >
              {incidents.length} incident{incidents.length === 1 ? "" : "s"} listed
            </Typography>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#A2B5A8" }}>Severity</TableCell>
                  <TableCell sx={{ fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#A2B5A8" }}>Status</TableCell>
                  <TableCell sx={{ fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#A2B5A8" }}>Incident</TableCell>
                  <TableCell sx={{ fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#A2B5A8" }}>Entities</TableCell>
                  <TableCell sx={{ fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#A2B5A8" }}>Detector</TableCell>
                  <TableCell align="right" sx={{ fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#A2B5A8" }}>Score</TableCell>
                  <TableCell sx={{ fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#A2B5A8" }}>Created</TableCell>
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
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: "0.92rem",
                          color: "#E8A65D",
                          fontWeight: 600,
                          textDecoration: "none",
                          "&:hover": {
                            textDecoration: "underline",
                            color: "#f0b46e",
                          },
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
                            sx={{
                              fontSize: "0.9rem",
                              fontFamily: '"JetBrains Mono", monospace',
                              color: theme.custom.classroomSlate900,
                            }}
                          >
                            <Box component="span" sx={{ fontWeight: 700 }}>{entity.host}</Box>
                            {entity.service ? (
                              <Box
                                component="span"
                                sx={{ color: theme.custom.classroomSlate500 }}
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
                          sx={{
                            fontSize: "0.9rem",
                            fontFamily: '"JetBrains Mono", monospace',
                            color: theme.custom.classroomSlate500,
                          }}
                        >
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography
                        sx={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: "0.88rem",
                          color: theme.custom.classroomSlate500,
                        }}
                      >
                        {incident.detector || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        title="Detector-specific unusualness — not a probability"
                        sx={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: "0.95rem",
                          fontWeight: 700,
                          color: theme.custom.classroomSlate900,
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
                        sx={{
                          fontSize: "0.88rem",
                          fontFamily: '"JetBrains Mono", monospace',
                          color: theme.custom.classroomSlate500,
                          whiteSpace: "nowrap",
                        }}
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
              p: 2.5,
              borderTop: `1px solid ${theme.palette.divider}`,
              bgcolor: "#0B0F0C",
            }}
          >
            {query.hasNextPage ? (
              <Button
                size="small"
                variant="outlined"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
                sx={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  px: 3,
                  py: 0.8,
                  borderRadius: 0,
                  color: theme.custom.classroomSlate900,
                  borderColor: "rgba(162, 181, 168, 0.4)",
                  "&:hover": {
                    borderColor: "#E8A65D",
                    color: "#E8A65D",
                    bgcolor: "rgba(232, 166, 93, 0.08)",
                  },
                }}
              >
                {query.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            ) : (
              <Typography
                variant="caption"
                sx={{
                  fontFamily: '"JetBrains Mono", monospace',
                  color: theme.custom.classroomSlate500,
                  fontSize: "0.85rem",
                }}
              >
                End of results.
              </Typography>
            )}
          </Box>
        </Paper>
      ) : null}
    </Box>
  );
}
