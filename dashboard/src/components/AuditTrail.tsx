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
          color: "#BACBC1",
          fontStyle: "italic",
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "0.85rem",
          py: 0.5,
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
          color: "#BACBC1",
          fontStyle: "italic",
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "0.85rem",
          py: 0.5,
        }}
      >
        No audit activity recorded yet.
      </Typography>
    );
  }

  return (
    <Box component="ol" sx={{ m: 0, p: 0, listStyle: "none", fontFamily: '"JetBrains Mono", monospace', position: "relative" }}>
      {list.map((entry, index) => (
        <Stack
          component="li"
          key={`${entry.at}-${entry.action}-${index}`}
          direction="row"
          gap={1.5}
          mb={1.5}
          sx={{
            px: { xs: 2, md: 2.5 },
            py: 1.5,
            bgcolor: "#0F1512",
            border: "1px solid rgba(162, 181, 168, 0.4)",
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              mt: "6px",
              flex: "none",
              borderRadius: "0 !important",
              bgcolor: dotColor(entry.action),
            }}
          />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="body2"
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "0.92rem",
                color: "#FFFFFF",
              }}
            >
              <strong style={{ color: "#E8A65D" }}>{entry.action}</strong> by {entry.actor}{" "}
              <Box
                component="time"
                dateTime={entry.at}
                title={formatTimestamp(entry.at)}
                sx={{ color: "#BACBC1", fontSize: "0.85rem", ml: 0.5 }}
              >
                {formatRelative(entry.at)}
              </Box>
            </Typography>
            {entry.note ? (
              <Typography
                variant="body2"
                sx={{
                  color: "#D2DFD7",
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: "0.85rem",
                  mt: 0.75,
                  px: 1.25,
                  py: 0.75,
                  bgcolor: "rgba(11, 15, 12, 0.8)",
                  border: "1px solid rgba(162, 181, 168, 0.35)",
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
  const list = windows ?? [];
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
        No observation window recorded.
      </Typography>
    );
  }

  return (
    <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none", fontFamily: '"JetBrains Mono", monospace' }}>
      {list.map((window) => (
        <Stack
          component="li"
          key={`${window.start}-${window.end}`}
          direction="row"
          gap={1.5}
          mb={1.5}
          sx={{
            px: { xs: 2, md: 2.5 },
            py: 1.75,
            bgcolor: "#0F1512",
            border: "1px solid rgba(162, 181, 168, 0.4)",
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="body2"
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "#FFFFFF",
              }}
            >
              {formatTimestamp(window.start)}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "#BACBC1",
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: "0.85rem",
                mt: 0.35,
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
