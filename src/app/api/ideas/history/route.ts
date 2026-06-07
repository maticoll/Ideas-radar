import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeOpportunity } from "@/lib/serialize";
import { getCurrentUser } from "@/lib/user";

export const dynamic = "force-dynamic";

// GET /api/ideas/history -> all opportunities with rank changes + saved status.
export async function GET() {
  const user = await getCurrentUser();
  const [opps, saved] = await Promise.all([
    prisma.opportunity.findMany({ orderBy: [{ finalScore: "desc" }] }),
    prisma.savedIdea.findMany({ where: { userId: user.id } }),
  ]);
  const savedMap = new Map(saved.map((s) => [s.opportunityId, s]));

  return NextResponse.json({
    count: opps.length,
    ideas: opps.map((o) => ({
      ...serializeOpportunity(o),
      saved: savedMap.has(o.id)
        ? { status: savedMap.get(o.id)!.status, notes: savedMap.get(o.id)!.notes }
        : null,
    })),
  });
}
