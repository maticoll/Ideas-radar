// Hacker News collector — real data with NO credentials needed.
// Uses the public Algolia HN Search API (https://hn.algolia.com/api), which is
// free and officially provided for this purpose. We search stories + comments
// from the last HN_WINDOW_DAYS for pain/intent phrases; the pipeline's
// analyzeIntent() then acts as the precision filter (noise is dropped there).
// Demo fallback only kicks in if the network call fails.

import type { CollectedPost } from "./reddit";

const HN_WINDOW_DAYS = 30;
const HITS_PER_QUERY = 50;

// Phrases mirrored from patterns.ts — recall here, precision in analyzeIntent.
const QUERIES = [
  '"I wish there was"',
  '"I would pay for"',
  '"someone should build"',
  '"is there a tool"',
  '"I need a tool"',
  '"why is there no"',
  '"looking for an app"',
  '"alternative to"',
];

const DEMO_POSTS: { author: string; text: string; points: number; daysAgo: number }[] = [
  { author: "hn_buildit", text: "I wish there was a tool that turns my GitHub issues into a public roadmap automatically. I would pay for that.", points: 142, daysAgo: 2 },
  { author: "hn_opslife", text: "Someone should build a dead-simple cost dashboard across AWS/GCP/Vercel. Existing ones are a nightmare to configure.", points: 98, daysAgo: 3 },
  { author: "hn_freelance", text: "Is there a tool that drafts contracts from a short client brief? Doing this manually wastes hours every week.", points: 75, daysAgo: 1 },
];

interface AlgoliaHit {
  objectID: string;
  author: string | null;
  created_at_i: number;
  title?: string | null; // stories
  url?: string | null;
  points?: number | null;
  num_comments?: number | null;
  comment_text?: string | null; // comments
  story_title?: string | null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchReal(): Promise<CollectedPost[]> {
  const since = Math.floor(Date.now() / 1000) - HN_WINDOW_DAYS * 86400;
  const byId = new Map<string, CollectedPost>();

  for (const q of QUERIES) {
    try {
      const params = new URLSearchParams({
        query: q,
        tags: "(story,comment)",
        numericFilters: `created_at_i>${since}`,
        hitsPerPage: String(HITS_PER_QUERY),
      });
      const res = await fetch(`https://hn.algolia.com/api/v1/search_by_date?${params}`, {
        headers: { "user-agent": "idea-radar/1.0" },
      });
      if (!res.ok) {
        console.warn(`[hackernews] Algolia HTTP ${res.status} for query ${q}`);
        continue;
      }
      const json = await res.json();
      for (const hit of (json?.hits ?? []) as AlgoliaHit[]) {
        if (byId.has(hit.objectID)) continue;
        const isStory = typeof hit.title === "string" && hit.title.length > 0;
        const text = isStory
          ? `${hit.title}${hit.comment_text ? ` — ${stripHtml(hit.comment_text).slice(0, 500)}` : ""}`
          : stripHtml(hit.comment_text ?? "").slice(0, 600);
        if (text.length < 40) continue; // too short to carry a real signal
        byId.set(hit.objectID, {
          source: "hackernews",
          sourceUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          sourceAuthor: hit.author ?? null,
          // Comments don't expose points on Algolia — use a modest baseline.
          engagementScore: isStory ? (hit.points ?? 0) + (hit.num_comments ?? 0) * 2 : 12,
          text,
          createdAtSource: new Date(hit.created_at_i * 1000),
        });
      }
    } catch (err) {
      console.warn(`[hackernews] fetch failed for query ${q}:`, (err as Error).message);
    }
  }
  return [...byId.values()];
}

export async function collectHackerNews(): Promise<CollectedPost[]> {
  const real = await fetchReal();
  if (real.length) return real;
  return DEMO_POSTS.map((p) => ({
    source: "hackernews" as const,
    sourceUrl: `https://news.ycombinator.com/item?id=demo_${p.author}`,
    sourceAuthor: p.author,
    text: p.text,
    engagementScore: p.points,
    createdAtSource: new Date(Date.now() - p.daysAgo * 86400000),
  }));
}
