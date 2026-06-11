// Google Trends collector. Google Trends has no official public API; real mode
// uses SerpApi's google_trends engine behind TRENDS_PROVIDER_KEY (an authorized
// provider — no scraping). Demo mode generates a deterministic 12-month series.
//
// Quota care: SerpApi's free plan is ~100 searches/month and we need 2 calls
// per keyword (timeseries + related queries). Real mode therefore only
// refreshes keywords whose stored Trend row is older than TRENDS_REFRESH_DAYS
// (default 7). With the 7 blueprint keywords that's ~56 calls/month. Returning
// [] when everything is fresh is normal — and real mode NEVER falls back to
// demo, so mock values can't overwrite real rows (they share keywords).

import { prisma } from "../db";
import { BLUEPRINTS } from "../blueprints";

export interface CollectedTrend {
  keyword: string;
  region: string;
  trendScore: number; // 0-100 current interest
  growth12m: number; // percent change over 12 months
  relatedQueries: string[];
  series: { month: string; value: number }[];
}

const KEYWORD_SEEDS: { keyword: string; region: string; base: number; growth: number; related: string[] }[] = [
  { keyword: "automate invoice reminders", region: "United States", base: 38, growth: 72, related: ["late invoice tool", "freelancer billing automation", "stripe invoice reminders"] },
  { keyword: "meeting notes to tasks", region: "Worldwide", base: 55, growth: 118, related: ["ai meeting summary", "action items from transcript", "otter alternative"] },
  { keyword: "support email to faq", region: "United States", base: 30, growth: 64, related: ["auto faq generator", "help center ai", "ticket deflection"] },
  { keyword: "shopify stockout prediction", region: "United Kingdom", base: 26, growth: 49, related: ["inventory forecasting", "shopify restock app", "demand planning"] },
  { keyword: "localized social media scheduler", region: "Worldwide", base: 44, growth: 81, related: ["multi language posts", "social automation", "content calendar ai"] },
  { keyword: "self hosted status page", region: "Germany", base: 22, growth: 33, related: ["uptime monitoring", "homelab status", "open source statuspage"] },
  { keyword: "proposal from call transcript", region: "United States", base: 19, growth: 58, related: ["ai proposal generator", "freelance proposal tool", "sow automation"] },
];

const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

function buildSeries(base: number, growth: number, keyword: string): { month: string; value: number }[] {
  // deterministic pseudo-random based on keyword
  let seed = 0;
  for (const c of keyword) seed += c.charCodeAt(0);
  const end = Math.min(100, Math.round(base * (1 + growth / 100)));
  return MONTHS.map((m, i) => {
    const t = i / (MONTHS.length - 1);
    const trendVal = base + (end - base) * t;
    const noise = ((Math.sin(seed + i * 1.7) + 1) / 2) * 8 - 4;
    return { month: m, value: Math.max(0, Math.min(100, Math.round(trendVal + noise))) };
  });
}

// ---- Real mode (SerpApi google_trends) ------------------------------------

const REGION_TO_GEO: Record<string, string> = {
  Worldwide: "",
  "United States": "US",
  "United Kingdom": "GB",
  Germany: "DE",
};

function refreshDays(): number {
  const raw = Number(process.env.TRENDS_REFRESH_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : 7;
}

interface TimelinePoint {
  timestamp?: string;
  values?: { extracted_value?: number }[];
}

async function serpApi(params: Record<string, string>): Promise<Record<string, unknown>> {
  const search = new URLSearchParams({ ...params, api_key: process.env.TRENDS_PROVIDER_KEY ?? "" });
  const res = await fetch(`https://serpapi.com/search.json?${search}`);
  if (!res.ok) throw new Error(`SerpApi HTTP ${res.status}`);
  const json = await res.json();
  if (json?.error) throw new Error(`SerpApi: ${json.error}`);
  return json;
}

// Collapse SerpApi's weekly timeline into the trailing 12 monthly averages.
function toMonthlySeries(timeline: TimelinePoint[]): { month: string; value: number }[] {
  const buckets = new Map<string, { label: string; sum: number; n: number }>();
  for (const p of timeline) {
    if (!p.timestamp) continue;
    const d = new Date(Number(p.timestamp) * 1000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2, "0")}`;
    const label = d.toLocaleString("en", { month: "short", timeZone: "UTC" });
    const value = p.values?.[0]?.extracted_value ?? 0;
    const b = buckets.get(key) ?? { label, sum: 0, n: 0 };
    b.sum += value;
    b.n++;
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-12)
    .map(([, b]) => ({ month: b.label, value: Math.round(b.sum / Math.max(1, b.n)) }));
}

async function fetchKeyword(keyword: string, region: string): Promise<CollectedTrend> {
  const geo = REGION_TO_GEO[region] ?? "";
  const base: Record<string, string> = { engine: "google_trends", q: keyword, date: "today 12-m" };
  if (geo) base.geo = geo;

  const ts = await serpApi({ ...base, data_type: "TIMESERIES" });
  const timeline = ((ts.interest_over_time as { timeline_data?: TimelinePoint[] })?.timeline_data ?? []) as TimelinePoint[];
  const series = toMonthlySeries(timeline);
  if (!series.length) throw new Error("empty timeseries");

  const first = series[0].value;
  const last = series[series.length - 1].value;
  const growth12m = Math.round(((last - first) / Math.max(1, first)) * 100);

  let relatedQueries: string[] = [];
  try {
    const rq = await serpApi({ ...base, data_type: "RELATED_QUERIES" });
    const related = rq.related_queries as { rising?: { query: string }[]; top?: { query: string }[] } | undefined;
    relatedQueries = [...(related?.rising ?? []), ...(related?.top ?? [])]
      .map((r) => r.query)
      .filter((q, i, arr) => arr.indexOf(q) === i)
      .slice(0, 3);
  } catch {
    // related queries are nice-to-have; don't fail the keyword over them
  }

  return { keyword, region, trendScore: last, growth12m, relatedQueries, series };
}

async function fetchReal(): Promise<CollectedTrend[]> {
  // Refresh only stale keywords to stay inside the provider quota.
  const targets = BLUEPRINTS.map((b) => ({ keyword: b.trendKeyword, region: b.region })).filter(
    (t, i, arr) => arr.findIndex((x) => x.keyword === t.keyword) === i,
  );
  const existing = await prisma.trend.findMany({
    where: { keyword: { in: targets.map((t) => t.keyword) } },
    select: { keyword: true, collectedAt: true },
  });
  const collectedAtByKeyword = new Map(existing.map((t) => [t.keyword, t.collectedAt]));
  const cutoff = Date.now() - refreshDays() * 86400000;
  const stale = targets.filter((t) => {
    const at = collectedAtByKeyword.get(t.keyword);
    return !at || at.getTime() < cutoff;
  });

  const out: CollectedTrend[] = [];
  for (const t of stale) {
    try {
      out.push(await fetchKeyword(t.keyword, t.region));
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("hasn't returned any results") || msg === "empty timeseries") {
        // Keyword too niche for Google Trends. Store an EMPTY row anyway so
        // the refresh window applies — otherwise it would be retried on every
        // run and burn the provider quota. The ranking treats an empty series
        // as "no data" (neutral default), not as zero interest.
        out.push({ keyword: t.keyword, region: t.region, trendScore: 0, growth12m: 0, relatedQueries: [], series: [] });
        console.warn(`[trends] "${t.keyword}": no Google Trends data — storing empty row until next refresh window`);
      } else {
        console.warn(`[trends] keyword "${t.keyword}" failed:`, msg);
      }
    }
  }
  if (stale.length) console.log(`[trends] refreshed ${out.length}/${stale.length} stale keywords`);
  return out;
}

export async function collectTrends(): Promise<CollectedTrend[]> {
  if (process.env.TRENDS_PROVIDER_KEY) {
    // Real mode: [] just means every keyword is still fresh. Never fall back
    // to demo here — mock rows share keywords and would overwrite real data.
    return fetchReal();
  }
  return KEYWORD_SEEDS.map((s) => ({
    keyword: s.keyword,
    region: s.region,
    trendScore: Math.min(100, Math.round(s.base * (1 + s.growth / 200))),
    growth12m: s.growth,
    relatedQueries: s.related,
    series: buildSeries(s.base, s.growth, s.keyword),
  }));
}
