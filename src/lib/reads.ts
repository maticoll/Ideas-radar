// Cached read paths for the opportunity lists.
//
// Opportunities only change when the ranking pipeline runs (~daily), so the
// list/top-5 are wrapped in unstable_cache with a short TTL and a shared tag.
// runRanking / admin refresh call revalidateTag(OPPORTUNITIES_TAG) to push fresh
// data immediately. Per-user "saved" state is NOT cached here — the routes
// overlay it fresh on top of the cached opportunity rows.

import { unstable_cache } from "next/cache";
import { prisma } from "./db";
import { serializeOpportunity } from "./serialize";

export const OPPORTUNITIES_TAG = "opportunities";

export const HISTORY_PAGE_SIZE = 24;
export const HISTORY_MAX_TAKE = 100;

// Top 5 for the dashboard "today" view (no per-user data -> fully cacheable).
export const getTodayTop = unstable_cache(
  async () => {
    const ideas = await prisma.opportunity.findMany({
      orderBy: { finalScore: "desc" },
      take: 5,
    });
    return ideas.map(serializeOpportunity);
  },
  ["ideas-today"],
  { revalidate: 60, tags: [OPPORTUNITIES_TAG] },
);

// A cursor-paginated page of opportunities (no per-user data).
// Ordering is deterministic (finalScore desc, id asc) so cursor paging on the
// unique id never skips or duplicates rows. Fetches one extra row to know if a
// next page exists.
export const getOpportunitiesPage = unstable_cache(
  async (cursor: string | null, take: number) => {
    const rows = await prisma.opportunity.findMany({
      orderBy: [{ finalScore: "desc" }, { id: "asc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    return {
      ideas: page.map(serializeOpportunity),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  },
  ["ideas-history-page"],
  { revalidate: 60, tags: [OPPORTUNITIES_TAG] },
);

export function clampTake(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return HISTORY_PAGE_SIZE;
  return Math.min(Math.floor(n), HISTORY_MAX_TAKE);
}
