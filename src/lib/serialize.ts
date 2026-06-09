// Turn Prisma rows into clean API/UI objects. JSON columns are native JSONB, so
// Prisma already hands them back parsed — we just narrow the types here.
import type { Prisma } from "@prisma/client";
import type { ScoreBreakdown, TrendPoint } from "./types";

type OpportunityRow = {
  id: string;
  title: string;
  problem: string;
  audience: string;
  whyNow: string;
  evidence: string;
  gap: string;
  mvp: string;
  businessModel: string;
  competitors: Prisma.JsonValue;
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
  scoreBreakdown: Prisma.JsonValue;
  trendKeyword: string | null;
  rankDate: Date;
  previousRank: number | null;
  rank: number | null;
  createdAt: Date;
};

export function serializeOpportunity(o: OpportunityRow) {
  return {
    id: o.id,
    title: o.title,
    problem: o.problem,
    audience: o.audience,
    whyNow: o.whyNow,
    evidence: o.evidence,
    gap: o.gap,
    mvp: o.mvp,
    businessModel: o.businessModel,
    competitors: Array.isArray(o.competitors) ? (o.competitors as string[]) : [],
    category: o.category,
    region: o.region,
    segment: o.segment,
    demandScore: o.demandScore,
    painScore: o.painScore,
    paymentIntentScore: o.paymentIntentScore,
    trendScore: o.trendScore,
    competitionScore: o.competitionScore,
    executionScore: o.executionScore,
    finalScore: o.finalScore,
    scoreBreakdown: (o.scoreBreakdown ?? {}) as unknown as ScoreBreakdown,
    trendKeyword: o.trendKeyword,
    rank: o.rank,
    previousRank: o.previousRank,
    rankChange: o.previousRank != null && o.rank != null ? o.previousRank - o.rank : null,
    rankDate: o.rankDate,
    createdAt: o.createdAt,
  };
}

type SignalRow = {
  id: string;
  source: string;
  sourceUrl: string;
  sourceAuthor: string | null;
  text: string;
  engagementScore: number;
  createdAtSource: Date;
  collectedAt: Date;
  language: string;
  category: string;
  keywords: Prisma.JsonValue;
  painScore: number;
  paymentIntentScore: number;
  matchedPattern: string | null;
};

export function serializeSignal(s: SignalRow) {
  return {
    ...s,
    keywords: Array.isArray(s.keywords) ? (s.keywords as string[]) : [],
  };
}

type TrendRow = {
  id: string;
  keyword: string;
  region: string;
  trendScore: number;
  growth12m: number;
  relatedQueries: Prisma.JsonValue;
  series: Prisma.JsonValue;
  collectedAt: Date;
};

export function serializeTrend(t: TrendRow) {
  return {
    ...t,
    relatedQueries: Array.isArray(t.relatedQueries) ? (t.relatedQueries as string[]) : [],
    series: Array.isArray(t.series) ? (t.series as unknown as TrendPoint[]) : [],
  };
}
