"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ScoreBreakdown } from "@/lib/types";
import { FACTOR_LABELS } from "@/lib/scoring";
import { scoreColor } from "./ScoreBadge";

export function ScoreBreakdownChart({ breakdown }: { breakdown: ScoreBreakdown }) {
  const keys = Object.keys(FACTOR_LABELS) as (keyof ScoreBreakdown)[];
  const data = keys.map((k) => ({
    factor: FACTOR_LABELS[k],
    value: breakdown[k] ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
        <XAxis type="number" domain={[0, 100]} stroke="#8b97b3" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="factor"
          stroke="#8b97b3"
          fontSize={11}
          width={150}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          contentStyle={{
            background: "#121826",
            border: "1px solid #26304a",
            borderRadius: 12,
            color: "#e7ecf7",
          }}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
          {data.map((d, i) => (
            <Cell key={i} fill={scoreColor(d.value)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
