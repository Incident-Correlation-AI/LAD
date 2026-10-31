import { Box, Grid, Stack, Typography, useTheme } from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { IncidentSeverity } from "../api/types";
import { severityColor } from "./Chips";

const ORDER: IncidentSeverity[] = ["critical", "high", "medium", "low"];

export function SeverityChart({ counts }: { counts: Record<IncidentSeverity, number> }) {
  const theme = useTheme();
  const total = ORDER.reduce((acc, s) => acc + (counts[s] ?? 0), 0);
  const data = ORDER.map((severity) => ({
    severity,
    incidents: counts[severity] ?? 0,
    pct: total > 0 ? Math.round(((counts[severity] ?? 0) / total) * 100) : 0,
  }));

  return (
    <Box sx={{ width: "100%" }}>
      <Grid container spacing={3} alignItems="center">
        {/* Monospace breakdown legend */}
        <Grid size={{ xs: 12, md: 4.5, lg: 4 }}>
          <Stack spacing={1.25}>
            {data.map((item) => {
              const color = severityColor(item.severity, theme);
              return (
                <Box
                  key={item.severity}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 2,
                    py: 1.1,
                    bgcolor: "#0F1512",
                    border: "1px solid rgba(162, 181, 168, 0.4)",
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: "0.88rem",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      color: "#FFFFFF",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {item.severity}
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography
                      sx={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: "1rem",
                        fontWeight: 700,
                        color: theme.custom.classroomSlate900,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {item.incidents}
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        color: theme.custom.classroomSlate500,
                        minWidth: 36,
                        textAlign: "right",
                      }}
                    >
                      {item.pct}%
                    </Typography>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </Grid>

        {/* Histogram Chart */}
        <Grid size={{ xs: 12, md: 7.5, lg: 8 }}>
          <Box sx={{ height: 225, width: "100%", minWidth: 0, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart
                data={data}
                barCategoryGap="25%"
                margin={{ top: 20, right: 16, left: -16, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="2 2"
                  vertical={false}
                  stroke="rgba(122, 139, 128, 0.2)"
                />
                <XAxis
                  dataKey="severity"
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fill: theme.custom.classroomSlate500,
                    fontSize: 13,
                    fontFamily: '"JetBrains Mono", monospace',
                    fontWeight: 700,
                  }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fill: theme.custom.classroomSlate500,
                    fontSize: 12,
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(232, 166, 93, 0.08)" }}
                  contentStyle={{
                    borderRadius: 0,
                    border: "1px solid rgba(122, 139, 128, 0.45)",
                    background: "#0B0F0C",
                    color: "#FFFFFF",
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 13,
                    boxShadow: "none",
                  }}
                  formatter={(value: number) => [`${value}`, "incidents"]}
                />
                <Bar dataKey="incidents" radius={[0, 0, 0, 0]} maxBarSize={90}>
                  {data.map((entry) => (
                    <Cell key={entry.severity} fill={severityColor(entry.severity, theme)} />
                  ))}
                  <LabelList
                    dataKey="incidents"
                    position="top"
                    offset={6}
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: '"JetBrains Mono", monospace',
                      fill: theme.custom.classroomSlate900,
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
