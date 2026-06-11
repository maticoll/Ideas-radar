import type { ScoreBreakdown } from "./types";

// Final opportunity score (0–100) is a weighted blend of 10 factors, exactly
// matching the brief. Each factor is normalized to 0–100 before weighting.

export const SCORE_WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  mentions: 0.14, // 1. cantidad de menciones
  paymentIntent: 0.16, // 2. intención de pago
  pain: 0.13, // 3. nivel de dolor
  engagement: 0.08, // 4. engagement
  trendGrowth: 0.12, // 5. crecimiento en Google Trends
  solutionGap: 0.11, // 6. falta de buenas soluciones
  abandonedDemand: 0.07, // 7. productos abandonados con demanda residual
  audienceClarity: 0.07, // 8. claridad del usuario objetivo
  mvpEase: 0.06, // 9. facilidad de construir un MVP
  marketPotential: 0.06, // 10. potencial B2B o B2C
};

export const FACTOR_LABELS: Record<keyof ScoreBreakdown, string> = {
  mentions: "Cantidad de menciones",
  paymentIntent: "Intención de pago",
  pain: "Nivel de dolor",
  engagement: "Engagement",
  trendGrowth: "Crecimiento (Google Trends)",
  solutionGap: "Falta de buenas soluciones",
  abandonedDemand: "Demanda residual abandonada",
  audienceClarity: "Claridad del usuario objetivo",
  mvpEase: "Facilidad de MVP",
  marketPotential: "Potencial B2B/B2C",
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export interface ScoreInputs {
  mentionCount: number; // number of grouped signals
  avgPaymentIntent: number; // 0-100
  avgPain: number; // 0-100
  avgEngagement: number; // raw, will be log-normalized
  trendGrowth12m: number; // percent, can exceed 100
  competitionScore: number; // 0-100, higher = more crowded
  abandonedDemand: number; // 0-100 (from abandoned PH products w/ residual demand)
  audienceClarity: number; // 0-100
  mvpEase: number; // 0-100
  marketPotential: number; // 0-100
}

export function computeBreakdown(inputs: ScoreInputs): ScoreBreakdown {
  return {
    mentions: clamp(Math.log2(inputs.mentionCount + 1) * 26),
    paymentIntent: clamp(inputs.avgPaymentIntent),
    pain: clamp(inputs.avgPain),
    // avgEngagement can be ≤ -1 if a source stored negative engagement
    // (e.g. downvoted posts) — guard the log against NaN.
    engagement: clamp(Math.log10(Math.max(0, inputs.avgEngagement) + 1) * 33),
    trendGrowth: clamp(50 + inputs.trendGrowth12m / 2),
    solutionGap: clamp(100 - inputs.competitionScore),
    abandonedDemand: clamp(inputs.abandonedDemand),
    audienceClarity: clamp(inputs.audienceClarity),
    mvpEase: clamp(inputs.mvpEase),
    marketPotential: clamp(inputs.marketPotential),
  };
}

export function finalScore(breakdown: ScoreBreakdown): number {
  let total = 0;
  for (const key of Object.keys(SCORE_WEIGHTS) as (keyof ScoreBreakdown)[]) {
    total += breakdown[key] * SCORE_WEIGHTS[key];
  }
  return clamp(total);
}

// Demand size estimate (rough, evidence-based) from mentions + engagement + trend.
export function estimateDemand(
  mentionCount: number,
  avgEngagement: number,
  trendScore: number,
): number {
  const base = mentionCount * 1200;
  const engagementFactor = 1 + Math.log10(Math.max(0, avgEngagement) + 1);
  const trendFactor = 0.5 + trendScore / 100;
  return Math.round(base * engagementFactor * trendFactor);
}
