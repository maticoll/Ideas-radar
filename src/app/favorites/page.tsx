"use client";

import { useEffect, useState } from "react";
import { IdeaCard } from "@/components/IdeaCard";
import { type Idea, STATUS_LABELS, STATUS_COLORS } from "@/lib/idea";

const ORDER = ["build", "validate", "research", "discard"];

export default function FavoritesPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ideas/history")
      .then((r) => r.json())
      .then((d) => setIdeas((d.ideas || []).filter((i: Idea) => i.saved)))
      .finally(() => setLoading(false));
  }, []);

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
    </div>
  );
}
