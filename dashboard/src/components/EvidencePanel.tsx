import { Box, Grid, List, ListItem, Typography, useTheme } from "@mui/material";
import type { ReactNode } from "react";

import type { Evidence } from "../api/types";

function Group({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone?: "positive" | "warning";
  children: ReactNode;
}) {
  const accentColor =
    tone === "positive"
      ? "#4ADE80"
      : tone === "warning"
        ? "#FB923C"
        : "#BACBC1";

  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          mb: 1.5,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "0.85rem",
          color: accentColor,
        }}
      >
        {title} · {count}
      </Typography>
      {children}
    </Box>
  );
}

function IdList({ ids }: { ids: string[] }) {
  const list = ids ?? [];
  if (!list.length) {
    return (
      <Typography
        variant="body2"
        sx={{
          color: "#BACBC1",
          fontStyle: "italic",
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "0.88rem",
          py: 0.75,
        }}
      >
        None recorded.
      </Typography>
    );
  }
  return (
    <List dense disablePadding>
      {list.map((id) => (
        <ListItem
          key={id}
          sx={{
            px: 2,
            py: 1,
            mb: 1,
            borderRadius: 0,
            bgcolor: "#0F1512",
            border: "1px solid rgba(162, 181, 168, 0.4)",
            transition: "border-color 0.15s ease",
            "&:hover": {
              borderColor: "rgba(232, 166, 93, 0.7)",
            },
          }}
        >
          {/* Log-derived strings are attacker-controlled: rendered as text
              nodes only, never as HTML. */}
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.88rem",
              color: "#FFFFFF",
              wordBreak: "break-all",
            }}
          >
            {id}
          </Typography>
        </ListItem>
      ))}
    </List>
  );
}

export function EvidencePanel({ evidence }: { evidence: Evidence }) {
  const theme = useTheme();
  const supporting = evidence.supporting_event_ids ?? [];
  const contradicting = evidence.contradicting_event_ids ?? [];
  const refs = evidence.redacted_refs ?? [];

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Group title="Supporting evidence" count={supporting.length} tone="positive">
            <IdList ids={supporting} />
          </Group>
        </Grid>

        {/* Always rendered, even when empty: citing only supporting evidence
            would not be honest about what the detector could not see. */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Group title="Contradicting evidence" count={contradicting.length} tone="warning">
            <IdList ids={contradicting} />
          </Group>
        </Grid>

        {refs.length ? (
          <Grid size={{ xs: 12 }}>
            <Group title="Redacted references" count={refs.length}>
              <IdList ids={refs} />
            </Group>
          </Grid>
        ) : null}
      </Grid>

      <Typography
        variant="caption"
        sx={{
          display: "block",
          mt: 2,
          pt: 1.5,
          borderTop: `1px solid ${theme.palette.divider}`,
          fontFamily: '"JetBrains Mono", monospace',
          color: theme.custom.classroomSlate500,
          fontSize: "0.82rem",
          lineHeight: 1.55,
        }}
      >
        Evidence IDs point back to the collector’s encrypted archive. Redacted
        references cite positions within the raw source stream before scrub.
      </Typography>
    </Box>
  );
}
