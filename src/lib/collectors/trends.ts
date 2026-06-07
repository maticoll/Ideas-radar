// Google Trends collector. Google Trends has no official public API; in real
// mode plug an authorized provider via TRENDS_PROVIDER_KEY. Demo mode generates
// a deterministic 12-month series per keyword.

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

async function fetchReal(): Promise<CollectedTrend[]> {
  // Wire an authorized Trends provider here using TRENDS_PROVIDER_KEY. Returns []
  // until implemented.
  return [];
}

export async function collectTrends(): Promise<CollectedTrend[]> {
  if (process.env.TRENDS_PROVIDER_KEY) {
    const real = await fetchReal();
    if (real.length) return real;
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
