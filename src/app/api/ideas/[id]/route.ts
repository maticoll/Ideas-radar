import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeOpportunity, serializeSignal, serializeTrend } from "@/lib/serialize";
import { getCurrentUser } from "@/lib/user";

export const dynamic = "force-dynamic";

// GET /api/ideas/:id -> full opportunity detail incl. evidence signals, trend,
// abandoned product and the current user's saved state.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const opp = await prisma.opportunity.findUnique({
    where: { id: params.id },
    include: { signals: { include: { rawSignal: true } } },
  });
  if (!opp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const trend = opp.trendKeyword
    ? await prisma.trend.findFirst({ where: { keyword: opp.trendKeyword } })
    : null;

  const evidenceSignals = opp.signals.map((s) => serializeSignal(s.rawSignal));

  const user = await getCurrentUser();
  const saved = await prisma.savedIdea.findFirst({
    where: { userId: user.id, opportunityId: opp.id },
  });

  return NextResponse.json({
    ...serializeOpportunity(opp),
    trend: trend ? serializeTrend(trend) : null,
    evidenceSignals,
    saved: saved ? { status: saved.status, notes: saved.notes } : null,
  });
}
