import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeTrend } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// GET /api/trends -> all collected Google Trends series.
export async function GET() {
  const trends = await prisma.trend.findMany({ orderBy: { growth12m: "desc" } });
  return NextResponse.json({ count: trends.length, trends: trends.map(serializeTrend) });
}
