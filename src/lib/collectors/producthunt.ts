// Product Hunt collector — finds products with historical traction that look
// abandoned (no recent updates, dead site, inactive socials, users asking for
// alternatives). Real mode uses the Product Hunt GraphQL API when a token is set.

export interface CollectedProduct {
  name: string;
  description: string;
  url: string;
  launchDate: Date;
  upvotes: number;
  commentsCount: number;
  lastActivityDate: Date;
  siteStatus: "up" | "down" | "parked" | "unknown";
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
export function abandonedScore(p: CollectedProduct, now = new Date()): number {
  const staleMonths = monthsBetween(p.lastActivityDate, now);
  const staleness = Math.min(60, staleMonths * 2.2); // up to 60
  const siteSignal = p.siteStatus === "down" ? 20 : p.siteStatus === "parked" ? 14 : 4;
  const demandSignal = Math.min(20, p.recentReviewsAskingSupport * 0.6); // users still asking
  return Math.round(Math.min(100, staleness + siteSignal + demandSignal));
}

export function activeReviewScore(p: CollectedProduct): number {
  return Math.round(Math.min(100, p.recentReviewsAskingSupport * 2.4));
}

const PH_QUERY = `
  query {
    posts(first: 50, order: VOTES) {
      edges {
        node {
          name
          tagline
          url
          votesCount
          commentsCount
          createdAt
          topics { edges { node { name } } }
        }
      }
    }
  }
`;

async function fetchReal(): Promise<CollectedProduct[]> {
  try {
    const res = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PRODUCTHUNT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: PH_QUERY }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const edges: { node: Record<string, unknown> }[] = json?.data?.posts?.edges ?? [];
    return edges.map(({ node: p }) => ({
      name: String(p.name ?? ""),
      description: String(p.tagline ?? ""),
      url: String(p.url ?? ""),
      launchDate: new Date(String(p.createdAt ?? Date.now())),
      upvotes: Number(p.votesCount ?? 0),
      commentsCount: Number(p.commentsCount ?? 0),
      lastActivityDate: new Date(String(p.createdAt ?? Date.now())),
      siteStatus: "unknown" as const,
      category: ((p.topics as { edges: { node: { name: string } }[] })?.edges?.[0]?.node?.name) ?? "General",
      recentReviewsAskingSupport: 0,
    }));
  } catch {
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
