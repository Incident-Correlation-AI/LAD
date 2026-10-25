import { Box, Stack, Typography, useTheme } from "@mui/material";

import type { AuditEntry, IncidentWindow } from "../api/types";
import { formatRelative, formatTimestamp } from "../lib/format";

export function AuditTrail({ entries }: { entries: AuditEntry[] }) {
  const theme = useTheme();

  if (!entries.length) {
    return (
      <Typography variant="body2" sx={{ color: theme.custom.classroomSlate400, fontStyle: "italic" }}>
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

  return (
    <Box component="ol" sx={{ m: 0, p: 0, listStyle: "none" }}>
      {entries.map((entry, index) => (
        <Stack component="li" key={`${entry.at}-${entry.action}-${index}`} direction="row" gap={1.5} mb={1.5}>
          <Box
            sx={{
              width: 9,
              height: 9,
              mt: "6px",
              flex: "none",
              borderRadius: "50%",
              bgcolor: dotColor(entry.action),
            }}
          />
          <Box>
            <Typography variant="body2">
              <strong>{entry.action}</strong> by {entry.actor}{" "}
              <Box
                component="time"
                dateTime={entry.at}
                title={formatTimestamp(entry.at)}
                sx={{ color: theme.custom.classroomSlate500 }}
              >
                {formatRelative(entry.at)}
              </Box>
            </Typography>
            {entry.note ? (
              <Typography variant="body2" sx={{ color: theme.custom.classroomSlate500 }}>
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

  if (!windows.length) {
    return (
      <Typography variant="body2" sx={{ color: theme.custom.classroomSlate400, fontStyle: "italic" }}>
        No observation window recorded.
      </Typography>
    );
  }

  return (
    <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
      {windows.map((window) => (
        <Stack component="li" key={`${window.start}-${window.end}`} direction="row" gap={1.5} mb={1.25}>
          <Box
            sx={{
              width: 2,
              alignSelf: "stretch",
              minHeight: 30,
              borderRadius: "2px",
              flex: "none",
              bgcolor: theme.custom.nileBlue200,
            }}
          />
          <Box>
            <Typography variant="body2">{formatTimestamp(window.start)}</Typography>
            <Typography variant="body2" sx={{ color: theme.custom.classroomSlate500 }}>
              → {formatTimestamp(window.end)}
            </Typography>
          </Box>
        </Stack>
      ))}
    </Box>
  );
}
