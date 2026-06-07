// Client-facing shape of a serialized opportunity (matches serialize.ts output).
import type { ScoreBreakdown, TrendPoint } from "./types";

export interface Idea {
  id: string;
  title: string;
  problem: string;
  audience: string;
  whyNow: string;
  evidence: string;
  gap: string;
  mvp: string;
  businessModel: string;
  competitors: string[];
  category: string;
  region: string;
  segment: string;
  demandScore: number;
  painScore: number;
  paymentIntentScore: number;
  trendScore: number;
  competitionScore: number;
  executionScore: number;
  finalScore: number;
  scoreBreakdown: ScoreBreakdown;
  trendKeyword: string | null;
  rank: number | null;
  previousRank: number | null;
  rankChange: number | null;
  rankDate: string;
  createdAt: string;
  saved?: { status: string; notes: string } | null;
}

export interface IdeaDetail extends Idea {
  trend: {
    keyword: string;
    region: string;
    trendScore: number;
    growth12m: number;
    relatedQueries: string[];
    series: TrendPoint[];
  } | null;
  evidenceSignals: {
    id: string;
    source: string;
    sourceUrl: string;
    sourceAuthor: string | null;
    text: string;
    engagementScore: number;
    painScore: number;
    paymentIntentScore: number;
    matchedPattern: string | null;
    keywords: string[];
  }[];
  saved: { status: string; notes: string } | null;
}

export const STATUS_LABELS: Record<string, string> = {
  research: "Investigar",
  validate: "Validar",
  discard: "Descartar",
  build: "Construir",
};

export const STATUS_COLORS: Record<string, string> = {
  research: "#22d3ee",
  validate: "#fbbf24",
  discard: "#f87171",
  build: "#34d399",
};

export function fmtDemand(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}
