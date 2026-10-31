import { Box, useTheme } from "@mui/material";
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
          barCategoryGap="30%"
          margin={{ top: 18, right: 8, left: -22, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="2 2"
            vertical={false}
            stroke="rgba(122, 139, 128, 0.18)"
          />
          <XAxis
            dataKey="severity"
            tickLine={false}
            axisLine={false}
            tick={{
              fill: theme.custom.classroomSlate500,
              fontSize: 11,
              fontFamily: '"JetBrains Mono", monospace',
              fontWeight: 600,
            }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{
              fill: theme.custom.classroomSlate500,
              fontSize: 10,
              fontFamily: '"JetBrains Mono", monospace',
            }}
          />
          <Tooltip
            cursor={{ fill: "rgba(232, 166, 93, 0.05)" }}
            contentStyle={{
              borderRadius: 0,
              border: "1px solid #7A8B80",
              background: "#0B0F0C",
              color: "#D7E0D9",
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 12,
              boxShadow: "none",
            }}
            formatter={(value: number) => [`${value}`, "incidents"]}
          />
          <Bar dataKey="incidents" radius={[0, 0, 0, 0]} maxBarSize={140}>
            {data.map((entry) => (
              <Cell key={entry.severity} fill={severityColor(entry.severity, theme)} />
            ))}
            <LabelList
              dataKey="incidents"
              position="top"
              offset={6}
              style={{
                fontSize: 11,
                fontWeight: 700,
                fontFamily: '"JetBrains Mono", monospace',
                fill: theme.custom.classroomSlate900,
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
