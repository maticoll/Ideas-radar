"use client";

import { useEffect, useMemo, useState } from "react";
import { IdeaCard } from "@/components/IdeaCard";
import { Filters, DEFAULT_FILTERS, type FilterState } from "@/components/Filters";
import type { Idea } from "@/lib/idea";

export default function DashboardPage() {
  const [today, setToday] = useState<Idea[]>([]);
  const [all, setAll] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  function loadData() {
    setLoading(true);
    return Promise.all([
      fetch("/api/ideas/today").then((r) => r.json()),
      fetch("/api/ideas/history").then((r) => r.json()),
    ])
      .then(([t, h]) => {
        setToday(t.ideas || []);
        setAll(h.ideas || []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMsg("Recolectando datos...");
    try {
      const res = await fetch("/api/admin/refresh", { method: "POST" });
      const data = await res.json();
      setRefreshMsg(`Listo — ${data.collected?.signalsInserted ?? 0} señales, ${data.ranked?.ideasUpserted ?? 0} ideas`);
      await loadData();
    } catch {
      setRefreshMsg("Error al actualizar");
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshMsg(""), 5000);
    }
  }

  const categories = useMemo(() => [...new Set(all.map((i) => i.category))].sort(), [all]);
  const regions = useMemo(() => [...new Set(all.map((i) => i.region))].sort(), [all]);

  const filtered = useMemo(() => {
    return all.filter((i) => {
      if (filters.category && i.category !== filters.category) return false;
      if (filters.segment && i.segment !== filters.segment) return false;
      if (filters.region && i.region !== filters.region) return false;
      if (i.finalScore < filters.minScore) return false;
      if (i.paymentIntentScore < filters.minPayment) return false;
      if (filters.execution === "easy" && i.executionScore < 70) return false;
      if (filters.execution === "medium" && (i.executionScore < 50 || i.executionScore >= 70)) return false;
      if (filters.execution === "hard" && i.executionScore >= 50) return false;
      return true;
    });
  }, [all, filters]);

  const date = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">{date}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              Top 5 oportunidades validadas de hoy
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Rankeadas por demanda real detectada en Reddit, X, Product Hunt y Google Trends. Cada idea
              incluye evidencia, audiencia, MVP y score de oportunidad.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium transition hover:bg-card disabled:opacity-50"
            >
              {refreshing ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <span>↻</span>
              )}
              {refreshing ? "Actualizando..." : "Actualizar datos"}
            </button>
            {refreshMsg && <p className="text-xs text-muted">{refreshMsg}</p>}
          </div>
        </div>
      </section>

      {loading ? (
        <SkeletonGrid />
      ) : today.length === 0 ? (
        <EmptyState />
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {today.map((idea, i) => (
            <IdeaCard key={idea.id} idea={idea} index={i} />
          ))}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Explorar todas las oportunidades</h2>
          <span className="text-sm text-muted">{filtered.length} resultados</span>
        </div>
        <Filters state={filters} onChange={setFilters} categories={categories} regions={regions} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card h-40 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-8 text-center">
      <p className="text-muted">
        No hay ideas todavía. Ejecuta <code className="text-text">npm run setup</code> para poblar la base
        de datos con datos demo.
      </p>
    </div>
  );
}
