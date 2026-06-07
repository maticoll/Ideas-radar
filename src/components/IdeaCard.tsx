import Link from "next/link";
import { ScoreBadge } from "./ScoreBadge";
import { type Idea, fmtDemand, STATUS_COLORS, STATUS_LABELS } from "@/lib/idea";

const SOURCE_ICON: Record<string, string> = {
  reddit: "Reddit",
  twitter: "X",
  producthunt: "Product Hunt",
};

export function IdeaCard({ idea, index }: { idea: Idea; index?: number }) {
  return (
    <Link
      href={`/idea/${idea.id}`}
      className="card group block p-5 transition hover:border-brand hover:shadow-lg hover:shadow-brand/10"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            {typeof index === "number" && (
              <span className="grid h-6 w-6 place-items-center rounded-md bg-panel2 text-xs font-bold text-muted">
                #{index + 1}
              </span>
            )}
            <span className="chip">{idea.category}</span>
            <span className="chip">{idea.segment}</span>
          </div>
          <h3 className="truncate text-lg font-semibold text-white group-hover:text-brand2">
            {idea.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted">{idea.problem}</p>
        </div>
        <ScoreBadge score={idea.finalScore} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <span>
          Demanda <strong className="text-text">{fmtDemand(idea.demandScore)}</strong>
        </span>
        <span>
          Pago <strong className="text-text">{idea.paymentIntentScore}</strong>
        </span>
        <span>
          Dolor <strong className="text-text">{idea.painScore}</strong>
        </span>
        <span className="flex items-center gap-1">
          Tendencia{" "}
          <strong className={idea.trendScore >= 50 ? "text-good" : "text-text"}>
            {idea.trendScore}
          </strong>
        </span>
        {idea.rankChange != null && idea.rankChange !== 0 && (
          <span className={idea.rankChange > 0 ? "text-good" : "text-bad"}>
            {idea.rankChange > 0 ? "▲" : "▼"} {Math.abs(idea.rankChange)}
          </span>
        )}
      </div>

      {idea.saved && (
        <div className="mt-3">
          <span
            className="chip"
            style={{ color: STATUS_COLORS[idea.saved.status], borderColor: STATUS_COLORS[idea.saved.status] }}
          >
            ★ {STATUS_LABELS[idea.saved.status] ?? idea.saved.status}
          </span>
        </div>
      )}
    </Link>
  );
}
