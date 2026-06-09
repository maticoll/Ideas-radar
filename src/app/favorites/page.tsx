"use client";

import { IdeaCard } from "@/components/IdeaCard";
import { LoadMore } from "@/components/LoadMore";
import { useIdeasFeed } from "@/lib/useIdeasFeed";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/idea";

const ORDER = ["build", "validate", "research", "discard"];

export default function FavoritesPage() {
  const { ideas, hasMore, loadingInitial, loadingMore, loadMore } = useIdeasFeed(true);
  const loading = loadingInitial;

  const groups = ORDER.map((status) => ({
    status,
    items: ideas.filter((i) => i.saved?.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Favoritos</h1>
        <p className="mt-1 text-sm text-muted">
          Ideas guardadas con tus notas y estado: investigar, validar, descartar o construir.
        </p>
      </div>

      {loading ? (
        <div className="card h-64 animate-pulse" />
      ) : ideas.length === 0 ? (
        <div className="card p-8 text-center text-muted">
          Aún no has guardado ideas. Abre una oportunidad y pulsa “Guardar”.
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.status}>
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: STATUS_COLORS[g.status] }}
                />
                <h2 className="text-lg font-semibold">{STATUS_LABELS[g.status]}</h2>
                <span className="text-sm text-muted">({g.items.length})</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {g.items.map((idea) => (
                  <div key={idea.id} className="space-y-2">
                    <IdeaCard idea={idea} />
                    {idea.saved?.notes && (
                      <p className="rounded-lg border border-border bg-panel2 p-3 text-xs text-muted">
                        {idea.saved.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {!loading && ideas.length > 0 && (
        <LoadMore hasMore={hasMore} loading={loadingMore} onLoadMore={loadMore} />
      )}
    </div>
  );
}
