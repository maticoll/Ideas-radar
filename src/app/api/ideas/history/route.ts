import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeOpportunity } from "@/lib/serialize";
import { getCurrentUser } from "@/lib/user";
import { getOpportunitiesPage, clampTake } from "@/lib/reads";

export const dynamic = "force-dynamic";

// GET /api/ideas/history?cursor=<id>&take=<n>&saved=true
//   default: cursor-paginated opportunities (cached) + this user's saved overlay.
//   saved=true: only the ideas this user saved (per-user, paginated by savedIdea).
// Response: { ideas, nextCursor } — nextCursor is null on the last page.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const take = clampTake(searchParams.get("take"));
  const savedOnly = searchParams.get("saved") === "true";

  if (savedOnly) {
    const user = await getCurrentUser();
    const rows = await prisma.savedIdea.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { opportunity: true },
    });
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    return NextResponse.json({
      ideas: page.map((s) => ({
        ...serializeOpportunity(s.opportunity),
        saved: { status: s.status, notes: s.notes },
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  }

  const { ideas, nextCursor } = await getOpportunitiesPage(cursor, take);

  // Overlay the current user's saved state — fresh, never cached.
  const user = await getCurrentUser();
  const saved = await prisma.savedIdea.findMany({
    where: { userId: user.id, opportunityId: { in: ideas.map((o) => o.id) } },
  });
  const savedMap = new Map(saved.map((s) => [s.opportunityId, s]));

  return NextResponse.json({
    ideas: ideas.map((o) => ({
      ...o,
      saved: savedMap.has(o.id)
        ? { status: savedMap.get(o.id)!.status, notes: savedMap.get(o.id)!.notes }
        : null,
    })),
    nextCursor,
  });
}
