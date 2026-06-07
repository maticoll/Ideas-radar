import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeOpportunity } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// GET /api/ideas/today -> the top 5 validated opportunities for today.
export async function GET() {
  const ideas = await prisma.opportunity.findMany({
    orderBy: { finalScore: "desc" },
    take: 5,
  });
  return NextResponse.json({
    date: new Date().toISOString().slice(0, 10),
    count: ideas.length,
    ideas: ideas.map(serializeOpportunity),
  });
}
