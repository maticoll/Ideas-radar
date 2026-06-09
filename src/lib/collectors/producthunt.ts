// Product Hunt collector — finds products with historical traction that look
// abandoned (no recent updates, dead/parked site, users asking for alternatives).
//
// Real mode (PRODUCTHUNT_TOKEN set) targets "abandoned but with residual demand":
//   1. Candidates: posts in an AGE WINDOW (launched 9–36 months ago) ordered by
//      VOTES — i.e. products that had real traction and are old enough to have
//      been left behind. (Plain `order: VOTES` returns today's hits, never
//      abandonware — that was the old bug.)
//   2. Last activity: the PH API exposes no "last updated" on a launch post, so we
//      approximate it with the NEWEST COMMENT date (community activity), falling
//      back to featuredAt/createdAt. Documented limitation, never left at 0.
//   3. Site health: a real HTTP GET (with timeout) to the product's external site
//      classifies it up / down / parked / unknown.
//   4. Residual demand: recent comments asking for support / alternatives / "is
//      this still alive?" are counted.
//
// Demo mode (no token) returns hand-made products and makes NO network calls.

export type SiteStatus = "up" | "down" | "parked" | "unknown";

export interface CollectedProduct {
  name: string;
  description: string;
  url: string; // Product Hunt page (used as the evidence source link)
  website?: string; // the product's external site (what we health-check)
  launchDate: Date;
  upvotes: number;
  commentsCount: number;
  lastActivityDate: Date;
  siteStatus: SiteStatus;
  category: string;
  recentReviewsAskingSupport: number;
}

const DEMO_PRODUCTS: CollectedProduct[] = [
  {
    name: "InvoiceChaser",
    description: "Automated late-invoice reminders for freelancers. Strong launch, then went quiet.",
    url: "https://www.producthunt.com/products/demo-invoicechaser",
    launchDate: new Date("2022-03-11"),
    upvotes: 1840,
    commentsCount: 213,
    lastActivityDate: new Date("2023-09-01"),
    siteStatus: "down",
    category: "Fintech",
    recentReviewsAskingSupport: 27,
  },
  {
    name: "MeetingToTasks",
    description: "Turned meeting transcripts into action items. Loved at launch, founders moved on.",
    url: "https://www.producthunt.com/products/demo-meetingtotasks",
    launchDate: new Date("2021-11-02"),
    upvotes: 2310,
    commentsCount: 301,
    lastActivityDate: new Date("2023-02-15"),
    siteStatus: "parked",
    category: "Productivity",
    recentReviewsAskingSupport: 41,
  },
  {
    name: "FAQforge",
    description: "Built FAQs from support tickets. Great reviews, abandoned after acquisition rumor.",
    url: "https://www.producthunt.com/products/demo-faqforge",
    launchDate: new Date("2022-06-20"),
    upvotes: 1290,
    commentsCount: 158,
    lastActivityDate: new Date("2023-05-10"),
    siteStatus: "down",
    category: "AI & Automation",
    recentReviewsAskingSupport: 33,
  },
  {
    name: "StatusZen",
    description: "Self-hosted status pages. Popular in homelab circles, repo went stale.",
    url: "https://www.producthunt.com/products/demo-statuszen",
    launchDate: new Date("2020-09-14"),
    upvotes: 980,
    commentsCount: 122,
    lastActivityDate: new Date("2022-12-01"),
    siteStatus: "up",
    category: "Developer Tools",
    recentReviewsAskingSupport: 18,
  },
  {
    name: "StockSeer",
    description: "Inventory stockout predictions for Shopify stores. Founders pivoted away.",
    url: "https://www.producthunt.com/products/demo-stockseer",
    launchDate: new Date("2021-04-30"),
    upvotes: 1560,
    commentsCount: 187,
    lastActivityDate: new Date("2023-01-20"),
    siteStatus: "parked",
    category: "E-commerce",
    recentReviewsAskingSupport: 24,
  },
];

function monthsBetween(a: Date, b: Date): number {
  return Math.abs((b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
}

// Compute an "abandoned but with residual demand" score 0-100.
// Inputs (all now derived from real data in real mode):
//   - staleness: months since last activity, capped (the longer quiet, the more
//     likely abandoned). 2.2 pts/month, max 60 -> ~27 months saturates it.
//   - siteSignal: a dead/parked external site is the strongest abandonment tell.
//   - demandSignal: people still asking for support/alternatives = residual demand.
export function abandonedScore(p: CollectedProduct, now = new Date()): number {
  const staleMonths = monthsBetween(p.lastActivityDate, now);
  const staleness = Math.min(60, staleMonths * 2.2);
  const siteSignal =
    p.siteStatus === "down" ? 20 : p.siteStatus === "parked" ? 14 : p.siteStatus === "unknown" ? 6 : 2;
  const demandSignal = Math.min(20, p.recentReviewsAskingSupport * 0.6);
  return Math.round(Math.min(100, staleness + siteSignal + demandSignal));
}

export function activeReviewScore(p: CollectedProduct): number {
  return Math.round(Math.min(100, p.recentReviewsAskingSupport * 2.4));
}

// ---- Site health check ---------------------------------------------------

const PARKED_HINTS = [
  "domain is for sale",
  "buy this domain",
  "this domain is parked",
  "domain for sale",
  "is for sale",
  "parked free",
  "sedoparking",
  "hugedomains",
  "godaddy.com/domains",
  "domain may be for sale",
];

// A real GET with a timeout. Conservative classification: only network failures,
// 5xx and gone (404/410) count as "down"; bot-blocking codes (401/403/429) stay
// "unknown" to avoid false positives; parking pages are detected by content.
async function checkSite(rawUrl: string, timeoutMs = 6000): Promise<SiteStatus> {
  if (!rawUrl) return "unknown";
  let url = rawUrl;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": "idea-radar/1.0 (+abandonment-check)" },
    });
    if (res.status >= 500 || res.status === 404 || res.status === 410) return "down";
    if (res.status === 401 || res.status === 403 || res.status === 429) return "unknown";
    if (res.status >= 400) return "down";
    const body = (await res.text()).slice(0, 6000).toLowerCase();
    if (PARKED_HINTS.some((h) => body.includes(h))) return "parked";
    return "up";
  } catch {
    return "down"; // DNS failure, connection refused, timeout
  } finally {
    clearTimeout(timer);
  }
}

// ---- Residual-demand detection from comments -----------------------------

const SUPPORT_HINTS = [
  "alternative",
  "still active",
  "still working",
  "still alive",
  "still using",
  "is this dead",
  "is it dead",
  "no longer",
  "abandoned",
  "not working",
  "site is down",
  "website is down",
  "shut down",
  "shutdown",
  "discontinued",
  "any update",
  "any alternatives",
  "is it down",
  "broken",
  "replacement for",
  "looking for a replacement",
];

function asksForSupport(body: string): boolean {
  const t = body.toLowerCase();
  return SUPPORT_HINTS.some((h) => t.includes(h));
}

// ---- Concurrency helper --------------------------------------------------

async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

// ---- Product Hunt GraphQL ------------------------------------------------

const PH_QUERY = `
  query AbandonedCandidates($postedAfter: DateTime, $postedBefore: DateTime) {
    posts(first: 20, order: VOTES, postedAfter: $postedAfter, postedBefore: $postedBefore) {
      edges {
        node {
          name
          tagline
          url
          website
          votesCount
          commentsCount
          createdAt
          featuredAt
          topics(first: 1) { edges { node { name } } }
          comments(first: 15, order: NEWEST) {
            edges { node { body createdAt } }
          }
        }
      }
    }
  }
`;

function monthsAgo(months: number, now = new Date()): string {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

interface PhComment {
  body: string;
  createdAt: Date | null;
}

async function fetchReal(): Promise<CollectedProduct[]> {
  try {
    const res = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PRODUCTHUNT_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: PH_QUERY,
        // Launched between 36 and 9 months ago: real traction, old enough to die.
        variables: { postedAfter: monthsAgo(36), postedBefore: monthsAgo(9) },
      }),
    });
    if (!res.ok) {
      console.warn(`[producthunt] API HTTP ${res.status} — falling back to demo`);
      return [];
    }
    const json = await res.json();
    if (json?.errors?.length) {
      console.warn("[producthunt] GraphQL errors — falling back to demo:", json.errors[0]?.message);
      return [];
    }
    const edges: { node: Record<string, unknown> }[] = json?.data?.posts?.edges ?? [];

    const products: CollectedProduct[] = edges.map(({ node: p }) => {
      const commentEdges = (p.comments as { edges?: { node: { body?: string; createdAt?: string } }[] })?.edges ?? [];
      const comments: PhComment[] = commentEdges.map((e) => ({
        body: String(e.node?.body ?? ""),
        createdAt: e.node?.createdAt ? new Date(String(e.node.createdAt)) : null,
      }));

      const created = new Date(String(p.createdAt ?? Date.now()));
      const featured = p.featuredAt ? new Date(String(p.featuredAt)) : created;
      const newestComment = comments.reduce<Date | null>(
        (acc, c) => (c.createdAt && (!acc || c.createdAt > acc) ? c.createdAt : acc),
        null,
      );
      // Proxy for "last activity": newest community signal we can see.
      const candidates = [newestComment, featured, created].filter((d): d is Date => !!d);
      const lastActivityDate = new Date(Math.max(...candidates.map((d) => d.getTime())));

      const recentReviewsAskingSupport = comments.filter((c) => asksForSupport(c.body)).length;

      return {
        name: String(p.name ?? ""),
        description: String(p.tagline ?? ""),
        url: String(p.url ?? ""),
        website: p.website ? String(p.website) : undefined,
        launchDate: created,
        upvotes: Number(p.votesCount ?? 0),
        commentsCount: Number(p.commentsCount ?? 0),
        lastActivityDate,
        siteStatus: "unknown" as SiteStatus,
        category:
          (p.topics as { edges?: { node: { name: string } }[] })?.edges?.[0]?.node?.name ?? "General",
        recentReviewsAskingSupport,
      };
    });

    // Health-check the external sites (bounded concurrency, never fatal).
    await mapWithConcurrency(products, 6, async (prod) => {
      prod.siteStatus = await checkSite(prod.website ?? "");
    });

    return products;
  } catch (err) {
    console.warn("[producthunt] fetch failed — falling back to demo:", (err as Error).message);
    return [];
  }
}

export async function collectProductHunt(): Promise<CollectedProduct[]> {
  if (process.env.PRODUCTHUNT_TOKEN) {
    const real = await fetchReal();
    if (real.length) return real;
  }
  return DEMO_PRODUCTS;
}
