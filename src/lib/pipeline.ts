// Core engine pipeline:
//   runCollection() — every 6h: collect, normalize, detect intent/pain, store.
//   runRanking()    — daily AM: cluster signals, cross with Trends + abandoned
//                     PH products, score, rank, produce the top opportunities.
//
// Performance: all existence checks are prefetched in a single query (no N+1
// findFirst-in-loop). Inserts are batched with createMany where possible.

import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { toJson, fromJson } from "./json";
import { analyzeIntent, extractKeywords, classifyCategory } from "./patterns";
import { collectReddit } from "./collectors/reddit";
import { collectTwitter } from "./collectors/twitter";
import { collectProductHunt, abandonedScore, activeReviewScore } from "./collectors/producthunt";
import { collectTrends } from "./collectors/trends";
import { bestBlueprint, type Blueprint } from "./blueprints";
import { computeBreakdown, finalScore, estimateDemand } from "./scoring";
import { enrichOpportunity } from "./ai";

export interface CollectionResult {
  redditCollected: number;
  twitterCollected: number;
  signalsStored: number;
  noiseFiltered: number;
  productsStored: number;
  trendsStored: number;
}

export async function runCollection(): Promise<CollectionResult> {
  const [reddit, twitter, products, trends] = await Promise.all([
    collectReddit(),
    collectTwitter(),
    collectProductHunt(),
    collectTrends(),
  ]);

  let noise = 0;
  const posts = [...reddit, ...twitter];

  // Prefetch existing signal URLs once (was N+1: one findFirst per post).
  const existing = await prisma.rawSignal.findMany({
    where: { sourceUrl: { in: posts.map((p) => p.sourceUrl) } },
    select: { sourceUrl: true },
  });
  const seenUrls = new Set(existing.map((s) => s.sourceUrl));

  const toCreate: Prisma.RawSignalCreateManyInput[] = [];
  for (const post of posts) {
    const intent = analyzeIntent(post.text);
    if (!intent.isSignal) {
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
      keywords: toJson(keywords),
      painScore: intent.painScore,
      paymentIntentScore: intent.paymentIntentScore,
      matchedPattern: intent.matchedPattern,
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
      relatedQueries: toJson(t.relatedQueries),
      series: toJson(t.series),
    };
    const id = trendIdByKeyword.get(t.keyword);
    if (id) await prisma.trend.update({ where: { id }, data });
    else await prisma.trend.create({ data });
  }

  const result: CollectionResult = {
    redditCollected: reddit.length,
    twitterCollected: twitter.length,
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
  signalsConsidered: number;
  signalsUnclustered: number;
  topFinalScores: number[];
}

export async function runRanking(): Promise<RankingResult> {
  const [signals, trends, products] = await Promise.all([
    prisma.rawSignal.findMany(),
    prisma.trend.findMany(),
    prisma.productHuntProduct.findMany(),
  ]);

  // ---- 1. Cluster signals into opportunities (group similar signals) ----
  const clusters = new Map<string, Cluster>();
  let unclustered = 0;
  for (const s of signals) {
    const keywords = fromJson<string[]>(s.keywords, []);
    const bp = bestBlueprint(s.text, keywords);
    if (!bp) {
      unclustered++; // signal matched no blueprint — raw material for new ideas
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

  // Snapshot previous ranks for "rank change" history.
  const prev = await prisma.opportunity.findMany({ select: { id: true, title: true, rank: true } });
  const prevRankByTitle = new Map(prev.map((o) => [o.title, o.rank ?? null]));
  const existingIdByTitle = new Map(prev.map((o) => [o.title, o.id]));

  const scored: {
    blueprint: Blueprint;
    signalIds: string[];
    breakdown: ReturnType<typeof computeBreakdown>;
    final: number;
    demandScore: number;
    competitionScore: number;
    trendScore: number;
    evidence: string;
  }[] = [];

  for (const c of clusters.values()) {
    const bp = c.blueprint;
    const trend = trends.find((t) => t.keyword === bp.trendKeyword);
    const product = bp.phProductName ? products.find((p) => p.name === bp.phProductName) : undefined;

    const avgPayment = c.paymentSum / c.count;
    const avgPain = c.painSum / c.count;
    const avgEngagement = c.engagementSum / c.count;
    const trendGrowth = trend?.growth12m ?? 0;
    const trendScore = trend?.trendScore ?? 30;
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
      (trend ? `Google Trends "${trend.keyword}" creció ${trendGrowth}% en 12 meses. ` : "") +
      (product ? `Producto abandonado con demanda residual: ${product.name} (abandono ${product.abandonedScore}/100).` : "");

    scored.push({ blueprint: bp, signalIds: c.signalIds, breakdown, final, demandScore, competitionScore: bp.competitionScore, trendScore, evidence });
  }

  scored.sort((a, b) => b.final - a.final);

  // ---- 2. Persist opportunities (upsert by title, refresh signal links) ----
  const signalLinks: Prisma.OpportunitySignalCreateManyInput[] = [];
  let rank = 0;
  for (const item of scored) {
    rank++;
    const bp = item.blueprint;

    const fallback = { problem: bp.problem, whyNow: bp.whyNow, mvp: bp.mvp, businessModel: bp.businessModel, gap: bp.gap };
    const enriched = await enrichOpportunity(
      { title: bp.title, problem: bp.problem, audience: bp.audience, category: bp.category, evidence: item.evidence },
      fallback,
    );

    const baseData = {
      title: bp.title,
      problem: enriched.problem,
      audience: bp.audience,
      whyNow: enriched.whyNow,
      evidence: item.evidence,
      gap: enriched.gap,
      mvp: enriched.mvp,
      businessModel: enriched.businessModel,
      competitors: toJson(bp.competitors),
      category: bp.category,
      region: bp.region,
      segment: bp.segment,
      demandScore: item.demandScore,
      painScore: item.breakdown.pain,
      paymentIntentScore: item.breakdown.paymentIntent,
      trendScore: item.trendScore,
      competitionScore: item.competitionScore,
      executionScore: item.breakdown.mvpEase,
      finalScore: item.final,
      scoreBreakdown: toJson(item.breakdown),
      trendKeyword: bp.trendKeyword,
      rankDate: new Date(),
      previousRank: prevRankByTitle.get(bp.title) ?? null,
      rank,
    };

    const existingId = existingIdByTitle.get(bp.title);
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
  }

  if (signalLinks.length) await prisma.opportunitySignal.createMany({ data: signalLinks });

  const result: RankingResult = {
    opportunitiesRanked: scored.length,
    signalsConsidered: signals.length,
    signalsUnclustered: unclustered,
    topFinalScores: scored.slice(0, 5).map((s) => s.final),
  };
  console.log("[pipeline:rank]", result);
  return result;
}
