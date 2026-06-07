// Core engine pipeline:
//   runCollection() — every 6h: collect, normalize, detect intent/pain, store.
//   runRanking()    — daily AM: cluster signals, cross with Trends + abandoned
//                     PH products, score, rank, produce the top opportunities.

import { prisma } from "./db";
import { toJson, fromJson } from "./json";
import { analyzeIntent, extractKeywords, classifyCategory } from "./patterns";
import { collectReddit } from "./collectors/reddit";
import { collectTwitter } from "./collectors/twitter";
import { collectProductHunt, abandonedScore, activeReviewScore } from "./collectors/producthunt";
import { collectTrends } from "./collectors/trends";
import { BLUEPRINTS, bestBlueprint, type Blueprint } from "./blueprints";
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

  let stored = 0;
  let noise = 0;
  const posts = [...reddit, ...twitter];

  for (const post of posts) {
    const intent = analyzeIntent(post.text);
    if (!intent.isSignal) {
      noise++; // separate noise from valuable signals
      continue;
    }
    const keywords = extractKeywords(post.text);
    const category = classifyCategory(post.text, keywords);

    // De-dupe by sourceUrl.
    const existing = await prisma.rawSignal.findFirst({ where: { sourceUrl: post.sourceUrl } });
    if (existing) continue;

    await prisma.rawSignal.create({
      data: {
        source: post.source,
        sourceUrl: post.sourceUrl,
        sourceAuthor: post.sourceAuthor,
        text: post.text,
        engagementScore: post.engagementScore,
        createdAtSource: post.createdAtSource,
        language: "en",
        category,
        keywords: toJson(keywords),
        painScore: intent.painScore,
        paymentIntentScore: intent.paymentIntentScore,
        matchedPattern: intent.matchedPattern,
      },
    });
    stored++;
  }

  // Upsert Product Hunt products.
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
    const existing = await prisma.productHuntProduct.findFirst({ where: { name: p.name } });
    if (existing) await prisma.productHuntProduct.update({ where: { id: existing.id }, data });
    else await prisma.productHuntProduct.create({ data });
  }

  // Upsert Trends.
  for (const t of trends) {
    const existing = await prisma.trend.findFirst({ where: { keyword: t.keyword } });
    const data = {
      keyword: t.keyword,
      region: t.region,
      trendScore: t.trendScore,
      growth12m: t.growth12m,
      relatedQueries: toJson(t.relatedQueries),
      series: toJson(t.series),
    };
    if (existing) await prisma.trend.update({ where: { id: existing.id }, data });
    else await prisma.trend.create({ data });
  }

  return {
    redditCollected: reddit.length,
    twitterCollected: twitter.length,
    signalsStored: stored,
    noiseFiltered: noise,
    productsStored: products.length,
    trendsStored: trends.length,
  };
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
  topFinalScores: number[];
}

export async function runRanking(): Promise<RankingResult> {
  const signals = await prisma.rawSignal.findMany();
  const trends = await prisma.trend.findMany();
  const products = await prisma.productHuntProduct.findMany();

  // ---- 1. Cluster signals into opportunities (group similar signals) ----
  const clusters = new Map<string, Cluster>();
  for (const s of signals) {
    const keywords = fromJson<string[]>(s.keywords, []);
    const bp = bestBlueprint(s.text, keywords);
    if (!bp) continue;
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
  const prev = await prisma.opportunity.findMany({ select: { title: true, rank: true } });
  const prevRankByTitle = new Map(prev.map((o) => [o.title, o.rank ?? null]));

  // Clear previous opportunities (keeps saved_ideas via onDelete: SetNull? we cascade)
  // To preserve saved ideas across re-ranks, we update-in-place by title instead.

  const scored: {
    blueprint: Blueprint;
    signalIds: string[];
    breakdown: ReturnType<typeof computeBreakdown>;
    final: number;
    demandScore: number;
    competitionScore: number;
    trendScore: number;
    evidence: string;
    sources: string[];
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

    scored.push({
      blueprint: bp,
      signalIds: c.signalIds,
      breakdown,
      final,
      demandScore,
      competitionScore: bp.competitionScore,
      trendScore,
      evidence,
      sources: sourceList,
    });
  }

  scored.sort((a, b) => b.final - a.final);

  // ---- 2. Persist opportunities (upsert by title, refresh signal links) ----
  let rank = 0;
  for (const item of scored) {
    rank++;
    const bp = item.blueprint;

    const fallback = {
      problem: bp.problem,
      whyNow: bp.whyNow,
      mvp: bp.mvp,
      businessModel: bp.businessModel,
      gap: bp.gap,
    };
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

    const existing = await prisma.opportunity.findFirst({ where: { title: bp.title } });
    let opportunityId: string;
    if (existing) {
      await prisma.opportunity.update({ where: { id: existing.id }, data: baseData });
      opportunityId = existing.id;
      await prisma.opportunitySignal.deleteMany({ where: { opportunityId } });
    } else {
      const created = await prisma.opportunity.create({ data: baseData });
      opportunityId = created.id;
    }

    for (const sigId of item.signalIds) {
      await prisma.opportunitySignal.create({ data: { opportunityId, rawSignalId: sigId } });
    }
  }

  return {
    opportunitiesRanked: scored.length,
    topFinalScores: scored.slice(0, 5).map((s) => s.final),
  };
}
