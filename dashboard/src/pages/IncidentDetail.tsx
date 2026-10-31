import {
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import type { ReactNode } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";

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
  return (
    <Paper
      sx={{
        px: { xs: 2.5, md: 3.5 },
        py: { xs: 2.5, md: 3.25 },
        height: "100%",
        bgcolor: "#0B0F0C",
        border: "1px solid rgba(162, 181, 168, 0.45)",
        borderRadius: 0,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={2} mb={subtitle ? 1 : 2.75}>
        <Box>
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.88rem",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#D2DFD7",
              mb: 0.5,
            }}
          >
            $ ./lad-section --{title.toLowerCase().replace(/\s+/g, "-")}
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 800,
              fontSize: "1.25rem",
              letterSpacing: "-0.01em",
              fontFamily: '"JetBrains Mono", monospace',
              color: "#FFFFFF",
            }}
          >
            {title}
          </Typography>
        </Box>
        {aside}
      </Stack>
      {subtitle ? (
        <Typography
          variant="body2"
          sx={{
            color: "#BACBC1",
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "0.9rem",
            lineHeight: 1.7,
            mb: 2.75,
          }}
        >
          {subtitle}
        </Typography>
      ) : null}
      {children}
    </Paper>
  );
}

function Meta({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <Box
      sx={{
        p: 2,
        bgcolor: "#0F1512",
        border: "1px solid rgba(162, 181, 168, 0.4)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <Box>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontWeight: 800,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "0.78rem",
            color: "#DCE5E0",
            mb: 0.75,
          }}
        >
          {label}
        </Typography>
        <Box
          sx={{
            fontWeight: 700,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "1.05rem",
            color: "#FFFFFF",
            wordBreak: "break-word",
          }}
        >
          {children}
        </Box>
      </Box>
      {hint ? (
        <Typography
          variant="caption"
          sx={{
            display: "block",
            fontFamily: '"JetBrains Mono", monospace',
            color: "#BACBC1",
            fontSize: "0.8rem",
            mt: 1,
          }}
        >
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}

export function IncidentDetail() {
  const { incidentId = "" } = useParams();
  const query = useIncident(incidentId);
  const { acknowledge, resolve } = useIncidentLifecycle(incidentId);

  if (query.isLoading) {
    return (
      <StateCard
        role="status"
        title="Loading incident"
        icon={<CircularProgress size={22} sx={{ color: "#E8A65D" }} />}
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
      {/* Navigation button */}
      <Button
        component={RouterLink}
        to="/"
        size="small"
        startIcon={<ArrowBackIcon sx={{ fontSize: 18 }} />}
        sx={{
          mb: 3,
          ml: -0.5,
          color: "#FFFFFF",
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "0.88rem",
          fontWeight: 600,
          borderRadius: 0,
          px: 2,
          py: 0.8,
          borderColor: "rgba(162, 181, 168, 0.45)",
          "&:hover": {
            borderColor: "#E8A65D",
            color: "#E8A65D",
            bgcolor: "rgba(232, 166, 93, 0.1)",
          },
        }}
      >
        All incidents
      </Button>

      {/* Terminal Inspection Header Banner */}
      <Paper
        sx={{
          px: { xs: 2.5, md: 4 },
          py: { xs: 2.5, md: 3.5 },
          mb: 3,
          bgcolor: "#0B0F0C",
          border: "1px solid rgba(162, 181, 168, 0.45)",
          borderRadius: 0,
        }}
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", lg: "center" }}
          gap={3}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "0.88rem",
                color: "#D2DFD7",
                mb: 0.75,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              $ lad-inspect --id
            </Typography>
            <Typography
              variant="h5"
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "#FFFFFF",
                wordBreak: "break-all",
                fontSize: { xs: "1.4rem", sm: "1.8rem", md: "2rem" },
                mb: 1.75,
              }}
            >
              {incident.incident_id}
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <SeverityChip severity={incident.severity} />
              <StatusChip status={incident.status} />
              <Typography
                variant="caption"
                sx={{
                  fontFamily: '"JetBrains Mono", monospace',
                  color: "#DCE5E0",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  px: 1.5,
                  py: 0.4,
                  border: "1px solid rgba(162, 181, 168, 0.45)",
                  bgcolor: "#0F1512",
                }}
              >
                {incident.detector} · schema {incident.schema_version}
              </Typography>
            </Stack>
          </Box>

          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Button
              variant="outlined"
              aria-label="Acknowledge"
              disabled={incident.status !== "open" || acknowledge.isPending}
              onClick={() => acknowledge.mutate()}
              sx={{
                borderRadius: 0,
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "0.88rem",
                fontWeight: 800,
                px: 3,
                py: 1,
                color: "#FFFFFF",
                borderColor: "rgba(232, 166, 93, 0.7)",
                bgcolor: "rgba(232, 166, 93, 0.16)",
                "&:hover": {
                  borderColor: "#f0b46e",
                  bgcolor: "rgba(232, 166, 93, 0.28)",
                },
                "&.Mui-disabled": {
                  borderColor: "rgba(122, 139, 128, 0.25)",
                  color: "rgba(186, 203, 193, 0.55)",
                  bgcolor: "transparent",
                },
              }}
            >
              {acknowledge.isPending ? "Acknowledging…" : "[ Acknowledge ]"}
            </Button>
            <Button
              variant="outlined"
              aria-label="Resolve"
              disabled={incident.status === "resolved" || resolve.isPending}
              onClick={() => resolve.mutate()}
              sx={{
                borderRadius: 0,
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "0.88rem",
                fontWeight: 800,
                px: 3,
                py: 1,
                color: "#FFFFFF",
                borderColor: "rgba(74, 222, 128, 0.7)",
                bgcolor: "rgba(74, 222, 128, 0.14)",
                "&:hover": {
                  borderColor: "#22c55e",
                  bgcolor: "rgba(74, 222, 128, 0.26)",
                },
                "&.Mui-disabled": {
                  borderColor: "rgba(122, 139, 128, 0.25)",
                  color: "rgba(186, 203, 193, 0.55)",
                  bgcolor: "transparent",
                },
              }}
            >
              {resolve.isPending ? "Resolving…" : "[ Resolve ]"}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {actionError ? (
        <Paper
          role="alert"
          sx={{
            mb: 3,
            p: 2,
            bgcolor: "rgba(239, 68, 68, 0.08)",
            border: "1px solid #ef4444",
            borderRadius: 0,
            color: "#EF4444",
            fontSize: "0.9rem",
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          Action failed: {actionError instanceof Error ? actionError.message : String(actionError)}
        </Paper>
      ) : null}

      <Grid container spacing={3} mb={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Section title="Detection">
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, sm: 4 }}>
                <Meta label="Anomaly score" hint="not a probability">
                  <Box
                    component="span"
                    title="Detector-specific unusualness — not a probability"
                    sx={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: "1.6rem",
                      fontWeight: 800,
                      color: "#FFFFFF",
                      fontVariantNumeric: "tabular-nums",
                      display: "inline-block",
                    }}
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
                    <Box component="span" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "0.85rem" }}>
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
            <Stack spacing={1.5} mb={3}>
              {(incident.affected_entities ?? []).length > 0 ? (
                (incident.affected_entities ?? []).map((entity, idx) => (
                  <Box
                    key={`${entity.host}-${entity.service ?? ""}-${entity.source ?? ""}-${idx}`}
                    sx={{
                      p: 2,
                      bgcolor: "#0F1512",
                      border: "1px solid rgba(162, 181, 168, 0.4)",
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 800,
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: "1rem",
                        color: "#FFFFFF",
                      }}
                    >
                      {entity.host}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#BACBC1",
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: "0.88rem",
                        display: "block",
                        mt: 0.5,
                      }}
                    >
                      {[entity.service, entity.source].filter(Boolean).join(" · ") || "—"}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography
                  variant="body2"
                  sx={{ color: "#BACBC1", fontFamily: '"JetBrains Mono", monospace', fontSize: "0.9rem" }}
                >
                  None recorded.
                </Typography>
              )}
            </Stack>

            <Typography
              variant="caption"
              sx={{
                display: "block",
                mb: 1.5,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 700,
                fontFamily: '"JetBrains Mono", monospace',
                color: "#DCE5E0",
                fontSize: "0.82rem",
              }}
            >
              Observation windows
            </Typography>
            <WindowTimeline windows={incident.windows ?? []} />
          </Section>
        </Grid>
      </Grid>

      <Box mb={3}>
        <Section title="Evidence">
          <EvidencePanel
            evidence={
              incident.evidence ?? { supporting_event_ids: [], contradicting_event_ids: [] }
            }
          />
        </Section>
      </Box>

      <Box mb={3}>
        <Section
          title={`Hypotheses (${(incident.hypotheses ?? []).length})`}
          subtitle="Confidence describes how strongly the evidence supports an explanation. It is not a probability, and “unknown” is a valid outcome."
        >
          {(incident.hypotheses ?? []).length ? (
            <Stack spacing={2.5}>
              {(incident.hypotheses ?? []).map((hypothesis, index) => (
                <HypothesisCard key={`${hypothesis.statement}-${index}`} hypothesis={hypothesis} />
              ))}
            </Stack>
          ) : (
            <Typography
              variant="body2"
              sx={{ color: "#BACBC1", fontFamily: '"JetBrains Mono", monospace', fontSize: "0.88rem" }}
            >
              No hypothesis recorded for this incident.
            </Typography>
          )}
        </Section>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Section
            title={`Diagnostic checks (${(incident.diagnostic_checks ?? []).length})`}
            subtitle="Recommendations for a human to follow. Nothing here is executed automatically — this product never remediates."
          >
            {(incident.diagnostic_checks ?? []).length ? (
              <Box component="ul" sx={{ m: 0, p: 0, display: "grid", gap: 2 }}>
                {(incident.diagnostic_checks ?? []).map((check, index) => (
                  <DiagnosticCheckItem key={`${check.instruction}-${index}`} check={check} />
                ))}
              </Box>
            ) : (
              <Typography
                variant="body2"
                sx={{ color: "#BACBC1", fontFamily: '"JetBrains Mono", monospace', fontSize: "0.88rem" }}
              >
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
