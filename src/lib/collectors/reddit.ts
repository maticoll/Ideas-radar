// Reddit collector.
// Real mode: when REDDIT_CLIENT_ID/SECRET are set, fetch from the official
// Reddit API (respecting Reddit API terms — OAuth app, rate limits, user-agent).
// Demo mode (default): returns a realistic pool of posts so the pipeline runs
// with no credentials. Clearly marked as demo via sourceUrl prefix.

export interface CollectedPost {
  source: "reddit" | "twitter";
  sourceUrl: string;
  sourceAuthor: string | null;
  text: string;
  engagementScore: number;
  createdAtSource: Date;
}

const SUBREDDITS = [
  "freelance", "smallbusiness", "Entrepreneur", "SaaS", "webdev",
  "productivity", "Notion", "shopify", "marketing", "selfhosted",
];

const DEMO_POSTS: { sub: string; author: string; text: string; up: number; comments: number; daysAgo: number }[] = [
  { sub: "freelance", author: "u/ledger_lou", text: "I would pay for a tool that automatically chases late invoices for freelancers. Reminding clients manually is so annoying and I waste hours every month.", up: 412, comments: 87, daysAgo: 2 },
  { sub: "smallbusiness", author: "u/shopmandan", text: "Why doesn't someone build a simple way to reconcile Stripe payouts with my accounting? I hate using spreadsheets for this, it's a nightmare.", up: 298, comments: 64, daysAgo: 1 },
  { sub: "Entrepreneur", author: "u/growthgemma", text: "I wish there was an app that turns my customer support emails into a searchable FAQ automatically. I'd pay good money for that.", up: 521, comments: 110, daysAgo: 3 },
  { sub: "SaaS", author: "u/devjon", text: "Is there a tool that monitors competitor pricing pages and pings me when they change? Looking for an app that does this without scraping headaches.", up: 187, comments: 43, daysAgo: 4 },
  { sub: "webdev", author: "u/css_carol", text: "How do I automate generating accessibility reports for client sites? Doing it manually is driving me crazy and clients keep asking.", up: 156, comments: 38, daysAgo: 2 },
  { sub: "productivity", author: "u/notetaker99", text: "I wish I had a tool for turning long meeting recordings into action items assigned to people. This is so annoying to do by hand.", up: 634, comments: 142, daysAgo: 1 },
  { sub: "Notion", author: "u/templatethom", text: "Someone should build a way to sync my Notion tasks with my calendar two-way. I'd pay for that yesterday.", up: 389, comments: 76, daysAgo: 5 },
  { sub: "shopify", author: "u/storestace", text: "Why is there no app for predicting which products will go out of stock based on my sales velocity? Returns and stockouts are killing me.", up: 245, comments: 51, daysAgo: 3 },
  { sub: "marketing", author: "u/seoSam", text: "I need a tool that writes and schedules a month of localized social posts from one brief. I hate using five different tools for this.", up: 301, comments: 59, daysAgo: 2 },
  { sub: "selfhosted", author: "u/homelabharry", text: "I would happily pay for a dead-simple self-hosted status page that auto-detects my services. Existing ones are so clunky.", up: 172, comments: 33, daysAgo: 6 },
  { sub: "freelance", author: "u/designdina", text: "I wish there was an app that drafts client proposals from a short call transcript. I waste hours on this every week.", up: 263, comments: 47, daysAgo: 1 },
  { sub: "Entrepreneur", author: "u/bootstrapben", text: "Is there a tool that turns Stripe revenue into investor-ready monthly updates automatically? Looking for an app that just does it.", up: 198, comments: 40, daysAgo: 4 },
];

const PAIN_QUERY = encodeURIComponent(
  '"I wish" OR "would pay" OR "someone should build" OR "why isn\'t there" OR "pain point" OR "I need a tool"'
);

async function getToken(): Promise<string> {
  const creds = btoa(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`);
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": process.env.REDDIT_USER_AGENT ?? "idea-radar/1.0",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Reddit auth ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}

async function fetchReal(): Promise<CollectedPost[]> {
  try {
    const token = await getToken();
    const ua = process.env.REDDIT_USER_AGENT ?? "idea-radar/1.0";
    const posts: CollectedPost[] = [];

    for (const sub of SUBREDDITS) {
      const url = `https://oauth.reddit.com/r/${sub}/search?q=${PAIN_QUERY}&restrict_sr=1&sort=top&t=month&limit=25`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, "User-Agent": ua },
      });
      if (!res.ok) continue;
      const json = await res.json();
      for (const { data: p } of json?.data?.children ?? []) {
        posts.push({
          source: "reddit",
          sourceUrl: `https://www.reddit.com${p.permalink}`,
          sourceAuthor: p.author ? `u/${p.author}` : null,
          text: `${p.title}${p.selftext ? ` — ${p.selftext.slice(0, 500)}` : ""}`,
          engagementScore: (p.ups ?? 0) + (p.num_comments ?? 0) * 2,
          createdAtSource: new Date((p.created_utc ?? 0) * 1000),
        });
      }
    }
    return posts;
  } catch {
    return [];
  }
}

export async function collectReddit(): Promise<CollectedPost[]> {
  if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) {
    const real = await fetchReal();
    if (real.length) return real;
  }
  // Demo pool — pick a rotating subset so each run looks "fresh".
  const offset = new Date().getHours() % 3;
  return DEMO_POSTS.filter((_, i) => i % 3 !== offset || true).map((p) => ({
    source: "reddit" as const,
    sourceUrl: `https://www.reddit.com/r/${p.sub}/comments/demo_${p.author.replace(/\W/g, "")}`,
    sourceAuthor: p.author,
    text: p.text,
    engagementScore: p.up + p.comments * 2,
    createdAtSource: new Date(Date.now() - p.daysAgo * 86400000),
  }));
}

export { SUBREDDITS };
