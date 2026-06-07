// Turn Prisma rows (with JSON-string fields) into clean API/UI objects.
import { fromJson } from "./json";
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
  competitors: string;
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
  scoreBreakdown: string;
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
    competitors: fromJson<string[]>(o.competitors, []),
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
    scoreBreakdown: fromJson<ScoreBreakdown | Record<string, number>>(o.scoreBreakdown, {} as any),
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
  keywords: string;
  painScore: number;
  paymentIntentScore: number;
  matchedPattern: string | null;
};

export function serializeSignal(s: SignalRow) {
  return {
    ...s,
    keywords: fromJson<string[]>(s.keywords, []),
  };
}

type TrendRow = {
  id: string;
  keyword: string;
  region: string;
  trendScore: number;
  growth12m: number;
  relatedQueries: string;
  series: string;
  collectedAt: Date;
};

export function serializeTrend(t: TrendRow) {
  return {
    ...t,
    relatedQueries: fromJson<string[]>(t.relatedQueries, []),
    series: fromJson<TrendPoint[]>(t.series, []),
  };
}
