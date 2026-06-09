"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScoreBadge, scoreColor } from "@/components/ScoreBadge";
import { TrendChart } from "@/components/TrendChart";
import { ScoreBreakdownChart } from "@/components/ScoreBreakdownChart";
import { SaveControls } from "@/components/SaveControls";
import { type IdeaDetail, fmtDemand } from "@/lib/idea";

const SOURCE_LABEL: Record<string, string> = {
  reddit: "Reddit",
  twitter: "X / Twitter",
  producthunt: "Product Hunt",
};

export default function IdeaDetailPage({ params }: { params: { id: string } }) {
  const [idea, setIdea] = useState<IdeaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/ideas/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then(setIdea)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="card h-64 animate-pulse" />;
  if (notFound || !idea)
    return (
      <div className="card p-8 text-center text-muted">
        Idea no encontrada. <Link href="/" className="text-brand2">Volver al dashboard</Link>
      </div>
    );

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-muted hover:text-white">
        ← Volver al dashboard
      </Link>

      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="chip">{idea.category}</span>
              <span className="chip">{idea.segment}</span>
              <span className="chip">{idea.region}</span>
              {idea.rank && <span className="chip">Ranking #{idea.rank}</span>}
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{idea.title}</h1>
            <p className="mt-2 max-w-2xl text-muted">{idea.problem}</p>
          </div>
          <div className="text-center">
            <ScoreBadge score={idea.finalScore} size={88} />
            <p className="mt-1 text-xs text-muted">Score de oportunidad</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Demanda estimada" value={fmtDemand(idea.demandScore)} />
          <Stat label="Intención de pago" value={`${idea.paymentIntentScore}/100`} />
          <Stat label="Nivel de dolor" value={`${idea.painScore}/100`} />
          <Stat label="Tendencia" value={`${idea.trendScore}/100`} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Narrative blocks */}
          <Block title="Audiencia objetivo">{idea.audience}</Block>
          <Block title="Por qué ahora">{idea.whyNow}</Block>
          <Block title="Gap detectado">{idea.gap}</Block>
          <Block title="MVP sugerido">{idea.mvp}</Block>
          <Block title="Modelo de negocio">{idea.businessModel}</Block>

          <div className="card p-5">
            <h3 className="mb-2 font-semibold">Competencia y productos similares</h3>
            <div className="flex flex-wrap gap-2">
              {idea.competitors.map((c) => (
                <span key={c} className="chip">
                  {c}
                </span>
              ))}
            </div>
          </div>

          {/* Trend chart */}
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Tendencia de búsqueda</h3>
              {idea.trend && (
                <span className={`text-sm ${idea.trend.growth12m >= 0 ? "text-good" : "text-bad"}`}>
                  {idea.trend.growth12m >= 0 ? "+" : ""}
                  {idea.trend.growth12m}% / 12 meses
                </span>
              )}
            </div>
            {idea.trend ? (
              <>
                <TrendChart data={idea.trend.series} />
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>Keyword: <strong className="text-text">{idea.trend.keyword}</strong></span>
                  <span>· Región: {idea.trend.region}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {idea.trend.relatedQueries.map((q) => (
                    <span key={q} className="chip">
                      {q}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">Sin datos de tendencia para esta oportunidad.</p>
            )}
          </div>

          {/* Evidence */}
          <div className="card p-5">
            <h3 className="mb-1 font-semibold">Evidencia de demanda</h3>
            <p className="mb-4 text-sm text-muted">{idea.evidence}</p>
            <div className="space-y-3">
              {idea.evidenceSignals.map((s) => (
                <div key={s.id} className="rounded-lg border border-border bg-panel2 p-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted">
                    <span className="font-semibold text-text">{SOURCE_LABEL[s.source] || s.source}</span>
                    <span>{s.sourceAuthor}</span>
                  </div>
                  <p className="text-sm">{s.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                    {s.matchedPattern && (
                      <span className="chip" style={{ color: "#fbbf24", borderColor: "#3a3a26" }}>
                        “{s.matchedPattern}”
                      </span>
                    )}
                    <span>Engagement {s.engagementScore}</span>
                    <span>Pago {s.paymentIntentScore}</span>
                    <span>Dolor {s.painScore}</span>
                    {s.sourceUrl && (
                      <a
                        href={s.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-brand2 hover:underline"
                      >
                        {s.sourceUrl.includes("demo_") ? "fuente demo ↗" : "ver fuente ↗"}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <SaveControls
            ideaId={idea.id}
            initialStatus={idea.saved?.status ?? null}
            initialNotes={idea.saved?.notes ?? ""}
            initialSaved={!!idea.saved}
          />

          <div className="card p-5">
            <h3 className="mb-3 font-semibold">Score desglosado</h3>
            <ScoreBreakdownChart breakdown={idea.scoreBreakdown as any} />
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm text-muted">Score final</span>
              <span className="text-lg font-bold" style={{ color: scoreColor(idea.finalScore) }}>
                {idea.finalScore}/100
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-panel2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-text/90">{children}</p>
    </div>
  );
}
