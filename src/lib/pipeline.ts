// Core engine pipeline:
//   runCollection() — every 6h: collect, normalize, detect intent/pain, store.
//   runRanking()    — daily AM: cluster signals, cross with Trends + abandoned
//                     PH products, score, rank, produce the top opportunities.
//
// Performance: all existence checks are prefetched in a single query (no N+1
// findFirst-in-loop). Inserts are batched with createMany where possible.

import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { analyzeIntent, extractKeywords, classifyCategory } from "./patterns";
import { collectReddit } from "./collectors/reddit";
import { collectTwitter } from "./collectors/twitter";
import { collectHackerNews } from "./collectors/hackernews";
import { collectStackExchange } from "./collectors/stackexchange";
import { collectProductHunt, abandonedScore, activeReviewScore } from "./collectors/producthunt";
import { collectTrends } from "./collectors/trends";
import { bestBlueprint, type Blueprint } from "./blueprints";
import { clusterSignals, type SemanticCluster } from "./semantic";
import { computeBreakdown, finalScore, estimateDemand } from "./scoring";
import { enrichOpportunity, describeCluster } from "./ai";

export interface CollectionResult {
  redditCollected: number;
  twitterCollected: number;
  hackernewsCollected: number;
  stackexchangeCollected: number;
  signalsStored: number;
  noiseFiltered: number;
  productsStored: number;
  trendsStored: number;
}

export async function runCollection(): Promise<CollectionResult> {
  const [reddit, twitter, hackernews, stackexchange, products, trends] = await Promise.all([
    collectReddit(),
    collectTwitter(),
    collectHackerNews(),
    collectStackExchange(),
    collectProductHunt(),
    collectTrends(),
  ]);

  let noise = 0;
  const posts = [...reddit, ...twitter, ...hackernews, ...stackexchange];

  // Prefetch existing signal URLs once (was N+1: one findFirst per post).
  const existing = await prisma.rawSignal.findMany({
    where: { sourceUrl: { in: posts.map((p) => p.sourceUrl) } },
    select: { sourceUrl: true },
  });
  const seenUrls = new Set(existing.map((s) => s.sourceUrl));

  const toCreate: Prisma.RawSignalCreateManyInput[] = [];
  for (const post of posts) {
    const intent = analyzeIntent(post.text);
    // Stack Exchange (softwarerecs/webapps) questions are software requests by
    // construction — the site is the demand signal, so they pass with modest
    // baseline scores even when no regex pattern matches the phrasing.
    const inherentDemand = post.source === "stackexchange";
    if (!intent.isSignal && !inherentDemand) {
      noise++; // separate noise from valuable signals
      continue;
    }
    if (seenUrls.has(post.sourceUrl)) continue; // de-dupe (DB + within batch)
    seenUrls.add(post.sourceUrl);

    const keywords = extractKeywords(post.text);
    toCreate.push({
      source: post.source,
      sourceUrl: post.sourceUrl,
      sourceAuthor: post.sourceAuthor,
      text: post.text,
      engagementScore: post.engagementScore,
      createdAtSource: post.createdAtSource,
      language: "en",
      category: classifyCategory(post.text, keywords),
      keywords, // JSONB (string[])
      painScore: intent.isSignal ? intent.painScore : 20,
      paymentIntentScore: intent.isSignal ? intent.paymentIntentScore : 15,
      matchedPattern: intent.matchedPattern ?? "Software request (Stack Exchange)",
    });
  }
  if (toCreate.length) await prisma.rawSignal.createMany({ data: toCreate });
  const stored = toCreate.length;

  // Upsert Product Hunt products — prefetch ids by name once.
  const existingProducts = await prisma.productHuntProduct.findMany({ select: { id: true, name: true } });
  const productIdByName = new Map(existingProducts.map((p) => [p.name, p.id]));
  for (const p of products) {
    const data = {
      name: p.name,
      description: p.description,
      url: p.url,
      launchDate: p.launchDate,
      upvotes: p.upvotes,
      commentsCount: p.commentsCount,
      lastActivityDate: p.lastActivityDate,
      abandonedScore: abandonedScore(p),
      activeReviewScore: activeReviewScore(p),
      siteStatus: p.siteStatus,
      category: p.category,
    };
    const id = productIdByName.get(p.name);
    if (id) await prisma.productHuntProduct.update({ where: { id }, data });
    else await prisma.productHuntProduct.create({ data });
  }

  // Upsert Trends — prefetch ids by keyword once.
  const existingTrends = await prisma.trend.findMany({ select: { id: true, keyword: true } });
  const trendIdByKeyword = new Map(existingTrends.map((t) => [t.keyword, t.id]));
  for (const t of trends) {
    const data = {
      keyword: t.keyword,
      region: t.region,
      trendScore: t.trendScore,
      growth12m: t.growth12m,
      relatedQueries: t.relatedQueries, // JSONB (string[])
      series: t.series, // JSONB ({month, value}[])
      collectedAt: new Date(), // freshness marker — drives the trends refresh window
    };
    const id = trendIdByKeyword.get(t.keyword);
    if (id) await prisma.trend.update({ where: { id }, data });
    else await prisma.trend.create({ data });
  }

  const result: CollectionResult = {
    redditCollected: reddit.length,
    twitterCollected: twitter.length,
    hackernewsCollected: hackernews.length,
    stackexchangeCollected: stackexchange.length,
    signalsStored: stored,
    noiseFiltered: noise,
    productsStored: products.length,
    trendsStored: trends.length,
  };
  console.log("[pipeline:collect]", result);
  return result;
}

interface Cluster {
  blueprint: Blueprint;
  signalIds: string[];
  sources: Set<string>;
  paymentSum: number;
  painSum: number;
  engagementSum: number;
  count: number;
}

export interface RankingResult {
  opportunitiesRanked: number;
  dynamicOpportunities: number;
  signalsConsidered: number;
  signalsUnclustered: number;
  topFinalScores: number[];
}

// T6: clustering engine. "semantic" (default) runs the blueprint pass first
// (seeds, never a closed catalog) and then clusters the leftover signals with
// TF-IDF/cosine so new opportunities emerge from the data. "keyword" restores
// the blueprint-only behaviour.
function clusterEngine(): "semantic" | "keyword" {
  return process.env.CLUSTER_ENGINE === "keyword" ? "keyword" : "semantic";
}

// Dynamic clusters have no hand-tuned blueprint heuristics, so scoring uses
// neutral defaults: the ranking stays deterministic and AI only writes text.
// Recalibration of these constants is T8's job.
const DYNAMIC_HEURISTICS = {
  competitionScore: 55,
  audienceClarity: 60,
  mvpEase: 60,
  marketPotential: 60,
};

// How far back runRanking scans raw signals for clustering. Keeps re-rankings
// from re-processing the whole history every run. Set RANKING_WINDOW_DAYS=0 to
// disable the window and scan every signal (original behaviour).
function rankingWindowDays(): number {
  const raw = Number(process.env.RANKING_WINDOW_DAYS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 90;
}

export async function runRanking(): Promise<RankingResult> {
  // Only cluster signals collected within the window (uses the collected_at
  // index). Older signals stay in the DB but no longer drive ranking.
  const windowDays = rankingWindowDays();
  const signalWhere: Prisma.RawSignalWhereInput =
    windowDays > 0
      ? { collectedAt: { gte: new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000) } }
      : {};

  const [signals, trends, products] = await Promise.all([
    prisma.rawSignal.findMany({ where: signalWhere }),
    prisma.trend.findMany(),
    prisma.productHuntProduct.findMany(),
  ]);

  // ---- 1a. Blueprint pass: group signals into the seeded topics ----
  const clusters = new Map<string, Cluster>();
  const unmatched: typeof signals = [];
  for (const s of signals) {
    const keywords = Array.isArray(s.keywords) ? (s.keywords as string[]) : [];
    const bp = bestBlueprint(s.text, keywords);
    if (!bp) {
      unmatched.push(s); // raw material for semantic discovery
      continue;
    }
    let c = clusters.get(bp.key);
    if (!c) {
      c = { blueprint: bp, signalIds: [], sources: new Set(), paymentSum: 0, painSum: 0, engagementSum: 0, count: 0 };
      clusters.set(bp.key, c);
    }
    c.signalIds.push(s.id);
    c.sources.add(s.source);
    c.paymentSum += s.paymentIntentScore;
    c.painSum += s.painScore;
    c.engagementSum += s.engagementScore;
    c.count++;
  }

  // ---- 1b. Semantic pass: cluster the leftovers so new ideas can emerge ----
  let dynamicClusters: SemanticCluster[] = [];
  if (clusterEngine() === "semantic" && unmatched.length >= 2) {
    dynamicClusters = clusterSignals(
      unmatched.map((s) => ({
        id: s.id,
        text: s.text,
        keywords: Array.isArray(s.keywords) ? (s.keywords as string[]) : [],
        category: s.category,
        engagementScore: s.engagementScore,
      })),
    );
  }
  const dynClusteredIds = new Set(dynamicClusters.flatMap((c) => c.signalIds));
  const unclustered = unmatched.length - dynClusteredIds.size;

  // Snapshot previous ranks for "rank change" history. clusterKey is the
  // stable identity; title is the fallback for legacy rows without one.
  const prev = await prisma.opportunity.findMany({ select: { id: true, title: true, rank: true, clusterKey: true } });
  const prevRankByTitle = new Map(prev.map((o) => [o.title, o.rank ?? null]));
  const existingIdByTitle = new Map(prev.map((o) => [o.title, o.id]));
  const prevRankByKey = new Map(prev.filter((o) => o.clusterKey).map((o) => [o.clusterKey as string, o.rank ?? null]));
  const existingIdByKey = new Map(prev.filter((o) => o.clusterKey).map((o) => [o.clusterKey as string, o.id]));

  interface ScoredBase {
    clusterKey: string;
    signalIds: string[];
    breakdown: ReturnType<typeof computeBreakdown>;
    final: number;
    demandScore: number;
    competitionScore: number;
    trendScore: number;
    evidence: string;
  }
  type ScoredItem =
    | (ScoredBase & { kind: "blueprint"; blueprint: Blueprint })
    | (ScoredBase & { kind: "dynamic"; cluster: SemanticCluster });
  const scored: ScoredItem[] = [];

  for (const c of clusters.values()) {
    const bp = c.blueprint;
    const trend = trends.find((t) => t.keyword === bp.trendKeyword);
    // Keywords too niche for Google Trends get stored with an empty series
    // (quota guard) — treat them as "no data", not as zero interest.
    const hasTrendData = !!trend && Array.isArray(trend.series) && (trend.series as unknown[]).length > 0;
    const product = bp.phProductName ? products.find((p) => p.name === bp.phProductName) : undefined;

    const avgPayment = c.paymentSum / c.count;
    const avgPain = c.painSum / c.count;
    const avgEngagement = c.engagementSum / c.count;
    const trendGrowth = hasTrendData ? trend.growth12m : 0;
    const trendScore = hasTrendData ? trend.trendScore : 30;
    const abandoned = product?.abandonedScore ?? 0;

    const breakdown = computeBreakdown({
      mentionCount: c.count,
      avgPaymentIntent: avgPayment,
      avgPain,
      avgEngagement,
      trendGrowth12m: trendGrowth,
      competitionScore: bp.competitionScore,
      abandonedDemand: abandoned,
      audienceClarity: bp.audienceClarity,
      mvpEase: bp.mvpEase,
      marketPotential: bp.marketPotential,
    });
    const final = finalScore(breakdown);
    const demandScore = estimateDemand(c.count, avgEngagement, trendScore);

    const sourceList = [...c.sources];
    const evidence =
      `${c.count} señales agrupadas desde ${sourceList.join(", ")}. ` +
      `Intención de pago promedio ${Math.round(avgPayment)}/100, dolor ${Math.round(avgPain)}/100. ` +
      (hasTrendData ? `Google Trends "${trend.keyword}" creció ${trendGrowth}% en 12 meses. ` : "") +
      (product ? `Producto abandonado con demanda residual: ${product.name} (abandono ${product.abandonedScore}/100).` : "");

    scored.push({ kind: "blueprint", blueprint: bp, clusterKey: bp.key, signalIds: c.signalIds, breakdown, final, demandScore, competitionScore: bp.competitionScore, trendScore, evidence });
  }

  const signalById = new Map(signals.map((s) => [s.id, s]));
  for (const dc of dynamicClusters) {
    const members = dc.signalIds.map((id) => signalById.get(id)!);
    const count = members.length;
    const avgPayment = members.reduce((acc, s) => acc + s.paymentIntentScore, 0) / count;
    const avgPain = members.reduce((acc, s) => acc + s.painScore, 0) / count;
    const avgEngagement = members.reduce((acc, s) => acc + s.engagementScore, 0) / count;
    const sources = [...new Set(members.map((m) => m.source))];

    const breakdown = computeBreakdown({
      mentionCount: count,
      avgPaymentIntent: avgPayment,
      avgPain,
      avgEngagement,
      trendGrowth12m: 0, // dynamic clusters have no matched trend keyword (yet)
      competitionScore: DYNAMIC_HEURISTICS.competitionScore,
      abandonedDemand: 0,
      audienceClarity: DYNAMIC_HEURISTICS.audienceClarity,
      mvpEase: DYNAMIC_HEURISTICS.mvpEase,
      marketPotential: DYNAMIC_HEURISTICS.marketPotential,
    });
    const final = finalScore(breakdown);
    const demandScore = estimateDemand(count, avgEngagement, 30);

    const evidence =
      `${count} señales agrupadas semánticamente desde ${sources.join(", ")}. ` +
      `Términos recurrentes: ${dc.topTerms.join(", ")}. ` +
      `Intención de pago promedio ${Math.round(avgPayment)}/100, dolor ${Math.round(avgPain)}/100.`;

    scored.push({ kind: "dynamic", cluster: dc, clusterKey: dc.key, signalIds: dc.signalIds, breakdown, final, demandScore, competitionScore: DYNAMIC_HEURISTICS.competitionScore, trendScore: 30, evidence });
  }

  scored.sort((a, b) => b.final - a.final);

  // ---- 2. Persist opportunities (upsert by clusterKey, refresh links) ----
  const signalLinks: Prisma.OpportunitySignalCreateManyInput[] = [];
  const snapshots: Prisma.RankingSnapshotCreateManyInput[] = [];
  let rank = 0;
  let dynamicKept = 0;
  let unclusteredFinal = unclustered;
  const persistedScores: number[] = [];
  for (const item of scored) {
    // Qualitative fields: blueprint text enriched by AI, or — for dynamic
    // clusters — written by AI from the cluster's real evidence (heuristic
    // fallback in both cases; scoring numbers are never AI-driven).
    let qualitative: {
      title: string;
      problem: string;
      audience: string;
      whyNow: string;
      gap: string;
      mvp: string;
      businessModel: string;
      competitors: string[];
      category: string;
      region: string;
      segment: string;
      trendKeyword: string | null;
    };
    if (item.kind === "blueprint") {
      const bp = item.blueprint;
      const fallback = { problem: bp.problem, whyNow: bp.whyNow, mvp: bp.mvp, businessModel: bp.businessModel, gap: bp.gap };
      const enriched = await enrichOpportunity(
        { title: bp.title, problem: bp.problem, audience: bp.audience, category: bp.category, evidence: item.evidence },
        fallback,
      );
      qualitative = {
        title: bp.title,
        problem: enriched.problem,
        audience: bp.audience,
        whyNow: enriched.whyNow,
        gap: enriched.gap,
        mvp: enriched.mvp,
        businessModel: enriched.businessModel,
        competitors: bp.competitors,
        category: bp.category,
        region: bp.region,
        segment: bp.segment,
        trendKeyword: bp.trendKeyword,
      };
    } else {
      const desc = await describeCluster({
        topTerms: item.cluster.topTerms,
        category: item.cluster.category,
        signalCount: item.signalIds.length,
        sampleTexts: item.cluster.sampleTexts,
      });
      if (!desc) {
        // AI coherence gate: the posts don't share one real need — drop the
        // candidate and count its signals as unclustered.
        console.log(`[pipeline:rank] cluster ${item.clusterKey} (${item.signalIds.length} señales) descartado por coherencia`);
        unclusteredFinal += item.signalIds.length;
        continue;
      }
      dynamicKept++;
      console.log(`[pipeline:rank] oportunidad dinámica: "${desc.title}" (${item.clusterKey}, ${item.signalIds.length} señales, ${desc.source})`);
      qualitative = {
        title: desc.title,
        problem: desc.problem,
        audience: desc.audience,
        whyNow: desc.whyNow,
        gap: desc.gap,
        mvp: desc.mvp,
        businessModel: desc.businessModel,
        competitors: [],
        category: desc.category,
        region: "Worldwide",
        segment: desc.segment,
        trendKeyword: null,
      };
    }

    rank++;
    persistedScores.push(item.final);
    const baseData = {
      clusterKey: item.clusterKey,
      title: qualitative.title,
      problem: qualitative.problem,
      audience: qualitative.audience,
      whyNow: qualitative.whyNow,
      evidence: item.evidence,
      gap: qualitative.gap,
      mvp: qualitative.mvp,
      businessModel: qualitative.businessModel,
      competitors: qualitative.competitors, // JSONB (string[])
      category: qualitative.category,
      region: qualitative.region,
      segment: qualitative.segment,
      demandScore: item.demandScore,
      painScore: item.breakdown.pain,
      paymentIntentScore: item.breakdown.paymentIntent,
      trendScore: item.trendScore,
      competitionScore: item.competitionScore,
      executionScore: item.breakdown.mvpEase,
      finalScore: item.final,
      scoreBreakdown: item.breakdown as unknown as Prisma.InputJsonValue, // JSONB (ScoreBreakdown)
      trendKeyword: qualitative.trendKeyword,
      rankDate: new Date(),
      previousRank: prevRankByKey.get(item.clusterKey) ?? prevRankByTitle.get(qualitative.title) ?? null,
      rank,
    };

    const existingId = existingIdByKey.get(item.clusterKey) ?? existingIdByTitle.get(qualitative.title);
    let opportunityId: string;
    if (existingId) {
      await prisma.opportunity.update({ where: { id: existingId }, data: baseData });
      opportunityId = existingId;
      await prisma.opportunitySignal.deleteMany({ where: { opportunityId } });
    } else {
      const created = await prisma.opportunity.create({ data: baseData });
      opportunityId = created.id;
    }
    for (const rawSignalId of item.signalIds) signalLinks.push({ opportunityId, rawSignalId });
    snapshots.push({ opportunityId, rank, finalScore: item.final });
  }

  if (signalLinks.length) await prisma.opportunitySignal.createMany({ data: signalLinks });
  // Append one ranking-history row per opportunity (date defaults to now()).
  if (snapshots.length) await prisma.rankingSnapshot.createMany({ data: snapshots });

  const result: RankingResult = {
    opportunitiesRanked: rank,
    dynamicOpportunities: dynamicKept,
    signalsConsidered: signals.length,
    signalsUnclustered: unclusteredFinal,
    topFinalScores: persistedScores.slice(0, 5),
  };
  console.log("[pipeline:rank]", result);
  return result;
}
