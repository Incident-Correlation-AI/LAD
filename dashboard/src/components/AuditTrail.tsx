import { Box, Stack, Typography, useTheme } from "@mui/material";

import type { AuditEntry, IncidentWindow } from "../api/types";
import { formatRelative, formatTimestamp } from "../lib/format";

export function AuditTrail({ entries }: { entries: AuditEntry[] }) {
  const theme = useTheme();

  if (!entries.length) {
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
        No lifecycle actions recorded yet.
      </Typography>
    );
  }

  const dotColor = (action: AuditEntry["action"]) =>
    action === "resolved"
      ? theme.custom.campusGreen600
      : action === "reopened"
        ? theme.custom.errorRed500
        : theme.custom.torchGold600;

  const list = entries ?? [];
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
        No audit activity recorded yet.
      </Typography>
    );
  }

  return (
    <Box component="ol" sx={{ m: 0, p: 0, listStyle: "none", fontFamily: '"JetBrains Mono", monospace' }}>
      {list.map((entry, index) => (
        <Stack component="li" key={`${entry.at}-${entry.action}-${index}`} direction="row" gap={1.5} mb={1.5}>
          <Box
            sx={{
              width: 8,
              height: 8,
              mt: "7px",
              flex: "none",
              borderRadius: "0 !important",
              bgcolor: dotColor(entry.action),
            }}
          />
          <Box>
            <Typography
              variant="body2"
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "0.82rem",
                color: theme.custom.classroomSlate900,
              }}
            >
              <strong style={{ color: "#E8A65D" }}>{entry.action}</strong> by {entry.actor}{" "}
              <Box
                component="time"
                dateTime={entry.at}
                title={formatTimestamp(entry.at)}
                sx={{ color: theme.custom.classroomSlate500, fontSize: "0.78rem" }}
              >
                {formatRelative(entry.at)}
              </Box>
            </Typography>
            {entry.note ? (
              <Typography
                variant="body2"
                sx={{
                  color: theme.custom.classroomSlate500,
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: "0.78rem",
                  mt: 0.25,
                }}
              >
                {entry.note}
              </Typography>
            ) : null}
          </Box>
        </Stack>
      ))}
    </Box>
  );
}

export function WindowTimeline({ windows }: { windows: IncidentWindow[] }) {
  const theme = useTheme();

  const list = windows ?? [];
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
        No observation window recorded.
      </Typography>
    );
  }

  return (
    <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none", fontFamily: '"JetBrains Mono", monospace' }}>
      {list.map((window) => (
        <Stack component="li" key={`${window.start}-${window.end}`} direction="row" gap={1.5} mb={1.25}>
          <Box
            sx={{
              width: 2,
              alignSelf: "stretch",
              minHeight: 28,
              borderRadius: 0,
              flex: "none",
              bgcolor: "#E8A65D",
            }}
          />
          <Box>
            <Typography
              variant="body2"
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "0.8rem",
                color: theme.custom.classroomSlate900,
              }}
            >
              {formatTimestamp(window.start)}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: theme.custom.classroomSlate500,
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "0.78rem",
              }}
            >
              → {formatTimestamp(window.end)}
            </Typography>
          </Box>
        </Stack>
      ))}
    </Box>
  );
}
