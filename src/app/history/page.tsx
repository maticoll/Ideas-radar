"use client";

import { useState } from "react";
import Link from "next/link";
import { ScoreBadge } from "@/components/ScoreBadge";
import { LoadMore } from "@/components/LoadMore";
import { useIdeasFeed } from "@/lib/useIdeasFeed";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/idea";

export default function HistoryPage() {
  const { ideas, hasMore, loadingInitial, loadingMore, loadMore } = useIdeasFeed(false);
  const [tab, setTab] = useState<"all" | "saved" | "discarded">("all");

  const rows = ideas.filter((i) => {
    if (tab === "saved") return i.saved && i.saved.status !== "discard";
    if (tab === "discarded") return i.saved?.status === "discard";
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Historial de oportunidades</h1>
        <p className="mt-1 text-sm text-muted">
          Ideas anteriores, cambios de ranking, guardadas y descartadas.
        </p>
      </div>

      <div className="flex gap-2">
        {([
          ["all", "Todas"],
          ["saved", "Guardadas"],
          ["discarded", "Descartadas"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === k ? "bg-panel2 text-white" : "text-muted hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loadingInitial ? (
        <div className="card h-64 animate-pulse" />
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center text-muted">Nada por aquí todavía.</div>
      ) : (
        <div className="card divide-y divide-border">
          {rows.map((i) => (
            <Link
              key={i.id}
              href={`/idea/${i.id}`}
              className="flex items-center gap-4 p-4 transition hover:bg-panel2"
            >
              <span className="w-8 text-center text-sm font-bold text-muted">
                {i.rank ? `#${i.rank}` : "—"}
              </span>
              <ScoreBadge score={i.finalScore} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{i.title}</p>
                <p className="truncate text-xs text-muted">
                  {i.category} · {i.segment} · {i.region}
                </p>
              </div>
              {i.rankChange != null && i.rankChange !== 0 && (
                <span className={`text-sm ${i.rankChange > 0 ? "text-good" : "text-bad"}`}>
                  {i.rankChange > 0 ? "▲" : "▼"} {Math.abs(i.rankChange)}
                </span>
              )}
              {i.saved && (
                <span
                  className="chip"
                  style={{ color: STATUS_COLORS[i.saved.status], borderColor: STATUS_COLORS[i.saved.status] }}
                >
                  {STATUS_LABELS[i.saved.status] ?? i.saved.status}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {tab === "all" && <LoadMore hasMore={hasMore} loading={loadingMore} onLoadMore={loadMore} />}
    </div>
  );
}
