// Twitter / X collector.
// Real mode: when TWITTER_BEARER_TOKEN is set, use the official X API v2 recent
// search (or an authorized provider). No illegal scraping. Demo mode otherwise.

import type { CollectedPost } from "./reddit";

const DEMO_TWEETS: { author: string; text: string; likes: number; rts: number; replies: number; daysAgo: number }[] = [
  { author: "@indie_maria", text: "I'd pay for a tool that auto-chases my unpaid invoices. Why is there no app for freelancers that just does this?", likes: 1240, rts: 210, replies: 88, daysAgo: 1 },
  { author: "@buildinpublic_k", text: "Someone should build a Stripe → investor update generator. I'd pay for it monthly, no question.", likes: 980, rts: 156, replies: 64, daysAgo: 2 },
  { author: "@pm_pete", text: "I wish I had a tool for turning meeting recordings into assigned action items. I would pay for X like this today.", likes: 1520, rts: 305, replies: 121, daysAgo: 1 },
  { author: "@shopify_sue", text: "I need a tool that predicts stockouts from my sales velocity. Why is there no app for this in 2026?", likes: 760, rts: 98, replies: 41, daysAgo: 3 },
  { author: "@growth_gary", text: "I would pay for X that writes a month of localized social posts from one brief. Juggling 5 tools is painful.", likes: 1105, rts: 188, replies: 73, daysAgo: 2 },
  { author: "@devops_dora", text: "Someone should build a self-hosted status page that auto-detects services. I'd pay for the no-config version.", likes: 690, rts: 120, replies: 35, daysAgo: 4 },
  { author: "@support_steph", text: "I wish there was an app that turns our support inbox into a living FAQ. I'd pay for that instantly.", likes: 1340, rts: 240, replies: 96, daysAgo: 1 },
  { author: "@freelance_fred", text: "I'd pay for a tool that drafts proposals from a call transcript. Writing them by hand eats my evenings.", likes: 845, rts: 134, replies: 52, daysAgo: 2 },
];

async function fetchReal(): Promise<CollectedPost[]> {
  // Real X API v2 wiring goes here:
  //   GET https://api.twitter.com/2/tweets/search/recent?query=...
  //   Authorization: Bearer <TWITTER_BEARER_TOKEN>
  // Returns [] until implemented to avoid ToS issues.
  return [];
}

export async function collectTwitter(): Promise<CollectedPost[]> {
  if (process.env.TWITTER_BEARER_TOKEN) {
    const real = await fetchReal();
    if (real.length) return real;
  }
  return DEMO_TWEETS.map((t) => ({
    source: "twitter" as const,
    sourceUrl: `https://x.com/${t.author.replace("@", "")}/status/demo_${Math.abs(hash(t.text))}`,
    sourceAuthor: t.author,
    text: t.text,
    engagementScore: t.likes + t.rts * 3 + t.replies * 2,
    createdAtSource: new Date(Date.now() - t.daysAgo * 86400000),
  }));
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
