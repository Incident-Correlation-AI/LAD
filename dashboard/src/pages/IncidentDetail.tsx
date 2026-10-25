import {
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Link as RouterLink, useParams } from "react-router-dom";
import type { ReactNode } from "react";

import { SeverityChip, StatusChip } from "../components/Chips";
import { AuditTrail, WindowTimeline } from "../components/AuditTrail";
import { DiagnosticCheckItem } from "../components/DiagnosticCheck";
import { EvidencePanel } from "../components/EvidencePanel";
import { HypothesisCard } from "../components/HypothesisCard";
import { ApiErrorState, StateCard } from "../components/StateCard";
import { useIncident, useIncidentLifecycle } from "../hooks/useIncidents";
import { formatAnomalyScore, formatTimestamp } from "../lib/format";

function Section({
  title,
  subtitle,
  aside,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Paper sx={{ p: 2.5, height: "100%" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={2} mb={0.5}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {aside}
      </Stack>
      {subtitle ? (
        <Typography variant="body2" sx={{ color: theme.custom.classroomSlate500, mb: 2 }}>
          {subtitle}
        </Typography>
      ) : (
        <Box sx={{ mb: 2 }} />
      )}
      {children}
    </Paper>
  );
}

function Meta({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const theme = useTheme();
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 700,
          color: theme.custom.classroomSlate400,
          mb: 0.25,
        }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, color: theme.custom.classroomSlate800 }}>
        {children}
      </Typography>
      {hint ? (
        <Typography variant="caption" sx={{ color: theme.custom.classroomSlate400 }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}

export function IncidentDetail() {
  const theme = useTheme();
  const { incidentId = "" } = useParams();
  const query = useIncident(incidentId);
  const { acknowledge, resolve } = useIncidentLifecycle(incidentId);

  if (query.isLoading) {
    return (
      <StateCard
        role="status"
        title="Loading incident"
        icon={<CircularProgress size={22} />}
        message="Fetching the incident record…"
      />
    );
  }

  if (query.isError) {
    return <ApiErrorState error={query.error} retry={() => void query.refetch()} />;
  }

  const incident = query.data;
  if (!incident) return <ApiErrorState error={new Error("Incident not found")} />;

  const actionError = acknowledge.error ?? resolve.error;

  return (
    <Box>
      <Button
        component={RouterLink}
        to="/"
        size="small"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2, ml: -1, color: theme.custom.classroomSlate600 }}
      >
        All incidents
      </Button>

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        gap={2}
        flexWrap="wrap"
        mb={2.5}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h5"
            sx={{
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: theme.custom.classroomSlate900,
              wordBreak: "break-all",
            }}
          >
            {incident.incident_id}
          </Typography>
          <Stack direction="row" spacing={1} mt={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <SeverityChip severity={incident.severity} />
            <StatusChip status={incident.status} />
            <Typography
              variant="caption"
              sx={{ fontFamily: "monospace", color: theme.custom.classroomSlate400 }}
            >
              {incident.detector} · schema {incident.schema_version}
            </Typography>
          </Stack>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            disabled={incident.status !== "open" || acknowledge.isPending}
            onClick={() => acknowledge.mutate()}
          >
            {acknowledge.isPending ? "Acknowledging…" : "Acknowledge"}
          </Button>
          <Button
            variant="contained"
            disabled={incident.status === "resolved" || resolve.isPending}
            onClick={() => resolve.mutate()}
          >
            {resolve.isPending ? "Resolving…" : "Resolve"}
          </Button>
        </Stack>
      </Stack>

      {actionError ? (
        <Paper
          role="alert"
          sx={{
            mb: 2.5,
            p: 1.5,
            bgcolor: theme.custom.errorRed100,
            borderColor: theme.custom.errorRed300,
            color: theme.custom.errorRed700,
            fontSize: "0.85rem",
          }}
        >
          Action failed: {actionError instanceof Error ? actionError.message : String(actionError)}
        </Paper>
      ) : null}

      <Grid container spacing={2.5} mb={2.5}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Section title="Detection">
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, sm: 4 }}>
                <Meta label="Anomaly score" hint="not a probability">
                  <Box
                    component="span"
                    title="Detector-specific unusualness — not a probability"
                    sx={{ fontFamily: "monospace", fontSize: "1.05rem" }}
                  >
                    {formatAnomalyScore(incident.anomaly_score)}
                  </Box>
                </Meta>
              </Grid>
              <Grid size={{ xs: 6, sm: 4 }}>
                <Meta label="Severity" hint="estimated operational impact">
                  {incident.severity}
                </Meta>
              </Grid>
              <Grid size={{ xs: 6, sm: 4 }}>
                <Meta label="Detector">{incident.detector}</Meta>
              </Grid>
              <Grid size={{ xs: 6, sm: 4 }}>
                <Meta label="Created">{formatTimestamp(incident.created_at)}</Meta>
              </Grid>
              <Grid size={{ xs: 6, sm: 4 }}>
                <Meta label="Updated">{formatTimestamp(incident.updated_at)}</Meta>
              </Grid>
              {incident.model_versions && Object.keys(incident.model_versions).length ? (
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Meta label="Model versions">
                    <Box component="span" sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                      {Object.entries(incident.model_versions)
                        .map(([name, version]) => `${name} ${version}`)
                        .join(" · ")}
                    </Box>
                  </Meta>
                </Grid>
              ) : null}
            </Grid>
          </Section>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Section title="Affected entities">
            <Stack spacing={1.25} mb={2.5}>
              {incident.affected_entities.map((entity) => (
                <Box key={`${entity.host}-${entity.service ?? ""}-${entity.source ?? ""}`}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {entity.host}
                  </Typography>
                  <Typography variant="caption" sx={{ color: theme.custom.classroomSlate500 }}>
                    {[entity.service, entity.source].filter(Boolean).join(" · ") || "—"}
                  </Typography>
                </Box>
              ))}
            </Stack>

            <Typography
              variant="caption"
              sx={{
                display: "block",
                mb: 1,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontWeight: 700,
                color: theme.custom.classroomSlate400,
              }}
            >
              Observation windows
            </Typography>
            <WindowTimeline windows={incident.windows ?? []} />
          </Section>
        </Grid>
      </Grid>

      <Box mb={2.5}>
        <Section title="Evidence">
          <EvidencePanel evidence={incident.evidence} />
        </Section>
      </Box>

      <Box mb={2.5}>
        <Section
          title={`Hypotheses (${incident.hypotheses.length})`}
          subtitle="Confidence describes how strongly the evidence supports an explanation. It is not a probability, and “unknown” is a valid outcome."
        >
          {incident.hypotheses.length ? (
            <Stack spacing={2}>
              {incident.hypotheses.map((hypothesis, index) => (
                <HypothesisCard key={`${hypothesis.statement}-${index}`} hypothesis={hypothesis} />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: theme.custom.classroomSlate500 }}>
              No hypothesis recorded for this incident.
            </Typography>
          )}
        </Section>
      </Box>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Section
            title={`Diagnostic checks (${incident.diagnostic_checks.length})`}
            subtitle="Recommendations for a human to follow. Nothing here is executed automatically — this product never remediates."
          >
            {incident.diagnostic_checks.length ? (
              <Box component="ul" sx={{ m: 0, p: 0, display: "grid", gap: 1.5 }}>
                {incident.diagnostic_checks.map((check, index) => (
                  <DiagnosticCheckItem key={`${check.instruction}-${index}`} check={check} />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: theme.custom.classroomSlate500 }}>
                No checks suggested.
              </Typography>
            )}
          </Section>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Section title="Audit trail">
            <AuditTrail entries={incident.audit} />
          </Section>
        </Grid>
      </Grid>
    </Box>
  );
}
