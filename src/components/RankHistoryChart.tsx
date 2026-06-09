"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface RankSnapshot {
  rank: number;
  finalScore: number;
  date: string;
}

// Evolution of an opportunity's score (left axis, 0-100) and rank (right axis,
// reversed so #1 sits at the top) across ranking runs. Needs >= 2 points.
export function RankHistoryChart({ data }: { data: RankSnapshot[] }) {
  if (!data || data.length < 2) {
    return (
      <p className="text-sm text-muted">
        Todavía no hay suficiente historial. Aparecerá cuando el ranking corra al menos dos veces.
      </p>
    );
  }

  const rows = data.map((d) => ({
    label: new Date(d.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
    score: d.finalScore,
    rank: d.rank,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={rows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="#26304a" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" stroke="#8b97b3" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="score"
          stroke="#8b97b3"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
        />
        <YAxis
          yAxisId="rank"
          orientation="right"
          reversed
          allowDecimals={false}
          domain={[1, "dataMax"]}
          stroke="#8b97b3"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "#121826",
            border: "1px solid #26304a",
            borderRadius: 12,
            color: "#e7ecf7",
          }}
          formatter={(value: number, name: string) =>
            name === "rank" ? [`#${value}`, "Ranking"] : [`${value}/100`, "Score"]
          }
        />
        <Line
          yAxisId="score"
          type="monotone"
          dataKey="score"
          name="score"
          stroke="#22d3ee"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          yAxisId="rank"
          type="monotone"
          dataKey="rank"
          name="rank"
          stroke="#fbbf24"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
