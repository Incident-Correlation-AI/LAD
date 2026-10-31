import { Box, List, ListItem, Typography, useTheme } from "@mui/material";
import type { ReactNode } from "react";

import type { Evidence } from "../api/types";

function Group({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          mb: 1,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontFamily: '"JetBrains Mono", monospace',
          color: theme.custom.classroomSlate500,
        }}
      >
        {title} · {count}
      </Typography>
      {children}
    </Box>
  );
}

function IdList({ ids }: { ids: string[] }) {
  const theme = useTheme();
  const list = ids ?? [];
  if (!list.length) {
    return (
      <Typography
        variant="body2"
        sx={{
          color: theme.custom.classroomSlate500,
          fontStyle: "italic",
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "0.8rem",
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
            px: 1.5,
            py: 0.6,
            mb: 0.75,
            borderRadius: 0,
            bgcolor: "#111613",
            border: "1px solid rgba(122, 139, 128, 0.25)",
          }}
        >
          {/* Log-derived strings are attacker-controlled: rendered as text
              nodes only, never as HTML. */}
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.78rem",
              color: "#D7E0D9",
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
      <Group title="Supporting evidence" count={supporting.length}>
        <IdList ids={supporting} />
      </Group>

      {/* Always rendered, even when empty: citing only supporting evidence
          would not be honest about what the detector could not see. */}
      <Group title="Contradicting evidence" count={contradicting.length}>
        <IdList ids={contradicting} />
      </Group>

      {refs.length ? (
        <Group title="Redacted references" count={refs.length}>
          <IdList ids={refs} />
        </Group>
      ) : null}

      <Typography
        variant="caption"
        sx={{
          display: "block",
          mt: 1,
          pt: 1,
          borderTop: `1px solid ${theme.palette.divider}`,
          fontFamily: '"JetBrains Mono", monospace',
          color: theme.custom.classroomSlate500,
          fontSize: "0.72rem",
        }}
      >
        Evidence IDs point back to the collector’s encrypted archive. Redacted
        references cite positions within the raw source stream before scrub.
      </Typography>
    </Box>
  );
}
