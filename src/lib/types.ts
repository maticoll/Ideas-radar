// Shared domain types used across the engine, API and UI.

export type SourceName = "reddit" | "twitter" | "producthunt";

export type Segment = "B2B" | "B2C" | "B2B2C";

export type SavedStatus = "research" | "validate" | "discard" | "build";

export interface TrendPoint {
  month: string;
  value: number;
}

export interface ScoreBreakdown {
  mentions: number; // 1. cantidad de menciones
  paymentIntent: number; // 2. intención de pago
  pain: number; // 3. nivel de dolor
  engagement: number; // 4. engagement
  trendGrowth: number; // 5. crecimiento Google Trends
  solutionGap: number; // 6. falta de buenas soluciones
  abandonedDemand: number; // 7. productos abandonados con demanda residual
  audienceClarity: number; // 8. claridad del usuario objetivo
  mvpEase: number; // 9. facilidad de construir MVP
  marketPotential: number; // 10. potencial B2B/B2C
}

export interface NormalizedSignal {
  source: SourceName;
  sourceUrl: string;
  sourceAuthor?: string | null;
  text: string;
  engagementScore: number;
  createdAtSource: Date;
  language: string;
  category: string;
  keywords: string[];
  painScore: number;
  paymentIntentScore: number;
  matchedPattern?: string | null;
}

export const CATEGORIES = [
  "Productivity",
  "Fintech",
  "Developer Tools",
  "Marketing",
  "Health & Wellness",
  "E-commerce",
  "Education",
  "AI & Automation",
  "Creator Economy",
  "HR & Recruiting",
] as const;

export type Category = (typeof CATEGORIES)[number];
