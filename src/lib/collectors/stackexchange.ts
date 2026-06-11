// Stack Exchange collector — real data with NO credentials needed.
// Uses the public Stack Exchange API (api.stackexchange.com, keyless quota
// ~300 req/day, we use 2 per run). softwarerecs.stackexchange.com is literally
// people asking for software that doesn't exist yet — pure demand signal —
// and webapps.stackexchange.com adds "how do I do X with tool Y" pain.
// Demo fallback only kicks in if the network calls fail.

import type { CollectedPost } from "./reddit";

const SE_WINDOW_DAYS = 30;
const SITES = ["softwarerecs", "webapps"];

const DEMO_QUESTIONS: { site: string; author: string; text: string; score: number; daysAgo: number }[] = [
  { site: "softwarerecs", author: "se_maker", text: "Looking for a tool that monitors my competitors' pricing pages and emails me a diff. Is there a tool that does this without me writing scrapers?", score: 21, daysAgo: 2 },
  { site: "softwarerecs", author: "se_ops", text: "I need a tool for turning recurring client reports into an automated dashboard. Building them by hand wastes hours every month.", score: 14, daysAgo: 4 },
  { site: "webapps", author: "se_pm", text: "Is there a web app that syncs tasks two-way between Notion and Google Calendar? Every workaround I try is so frustrating.", score: 18, daysAgo: 1 },
];

interface SeQuestion {
  question_id: number;
  title: string;
  body?: string;
  link: string;
  score: number;
  answer_count: number;
  view_count: number;
  creation_date: number;
  owner?: { display_name?: string };
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
  const fromdate = Math.floor(Date.now() / 1000) - SE_WINDOW_DAYS * 86400;
  const posts: CollectedPost[] = [];

  for (const site of SITES) {
    try {
      const params = new URLSearchParams({
        order: "desc",
        sort: "creation",
        site,
        pagesize: "50",
        fromdate: String(fromdate),
        filter: "withbody",
      });
      const res = await fetch(`https://api.stackexchange.com/2.3/questions?${params}`, {
        headers: { "user-agent": "idea-radar/1.0" },
      });
      if (!res.ok) {
        console.warn(`[stackexchange] API HTTP ${res.status} for site ${site}`);
        continue;
      }
      const json = await res.json();
      for (const q of (json?.items ?? []) as SeQuestion[]) {
        const body = q.body ? stripHtml(q.body).slice(0, 500) : "";
        posts.push({
          source: "stackexchange",
          sourceUrl: q.link,
          sourceAuthor: q.owner?.display_name ?? null,
          text: `${stripHtml(q.title)}${body ? ` — ${body}` : ""}`,
          // q.score can be negative (downvoted questions) — never store < 0.
          engagementScore: Math.max(
            0,
            q.score * 8 + q.answer_count * 6 + Math.min(150, Math.round((q.view_count ?? 0) / 25)),
          ),
          createdAtSource: new Date(q.creation_date * 1000),
        });
      }
    } catch (err) {
      console.warn(`[stackexchange] fetch failed for site ${site}:`, (err as Error).message);
    }
  }
  return posts;
}

export async function collectStackExchange(): Promise<CollectedPost[]> {
  const real = await fetchReal();
  if (real.length) return real;
  return DEMO_QUESTIONS.map((q) => ({
    source: "stackexchange" as const,
    sourceUrl: `https://${q.site}.stackexchange.com/questions/demo_${q.author}`,
    sourceAuthor: q.author,
    text: q.text,
    engagementScore: q.score * 8,
    createdAtSource: new Date(Date.now() - q.daysAgo * 86400000),
  }));
}
