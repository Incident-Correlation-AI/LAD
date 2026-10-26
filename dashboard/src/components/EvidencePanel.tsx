import { Box, List, ListItem, Typography, alpha, useTheme } from "@mui/material";
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
          color: theme.custom.classroomSlate400,
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
      <Typography variant="body2" sx={{ color: theme.custom.classroomSlate400, fontStyle: "italic" }}>
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
            px: 1.25,
            py: 0.5,
            mb: 0.5,
            borderRadius: "6px",
            bgcolor: alpha(theme.custom.classroomSlate500, 0.04),
          }}
        >
          {/* Log-derived strings are attacker-controlled: rendered as text
              nodes only, never as HTML. */}
          <Typography sx={{ fontFamily: "monospace", fontSize: "0.78rem", wordBreak: "break-all" }}>
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
          color: theme.custom.classroomSlate400,
        }}
      >
        Raw logs are not archived by default. References point to redacted
        extracts only.
      </Typography>
    </Box>
  );
}
