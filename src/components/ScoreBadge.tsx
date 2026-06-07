export function scoreColor(score: number): string {
  if (score >= 75) return "#34d399";
  if (score >= 55) return "#fbbf24";
  return "#f87171";
}

export function ScoreBadge({ score, size = 56 }: { score: number; size?: number }) {
  const color = scoreColor(score);
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * c;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#26304a" strokeWidth={4} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={4}
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color }}>
        {Math.round(score)}
      </span>
    </div>
  );
}
