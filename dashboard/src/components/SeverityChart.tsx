import { Box, useTheme, alpha } from "@mui/material";
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
  const data = ORDER.map((severity) => ({
    severity,
    incidents: counts[severity],
  }));

  return (
    <Box sx={{ height: 220, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          // Thick bars: the band is ~270px wide per category on desktop, so a
          // 30% gap leaves a wide, readable bar instead of a hairline.
          barCategoryGap="30%"
          margin={{ top: 18, right: 8, left: -22, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke={theme.palette.divider}
          />
          <XAxis
            dataKey="severity"
            tickLine={false}
            axisLine={false}
            tick={{ fill: theme.custom.classroomSlate500, fontSize: 12, fontWeight: 600 }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: theme.custom.classroomSlate400, fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: alpha(theme.custom.nileBlue300, 0.12) }}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${theme.palette.divider}`,
              background: "#fff",
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(16,24,40,0.08)",
            }}
            formatter={(value: number) => [`${value}`, "incidents"]}
          />
          <Bar dataKey="incidents" radius={[6, 6, 0, 0]} maxBarSize={140}>
            {data.map((entry) => (
              <Cell key={entry.severity} fill={severityColor(entry.severity, theme)} />
            ))}
            <LabelList
              dataKey="incidents"
              position="top"
              offset={6}
              style={{
                fontSize: 12,
                fontWeight: 700,
                fill: theme.custom.classroomSlate600,
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
