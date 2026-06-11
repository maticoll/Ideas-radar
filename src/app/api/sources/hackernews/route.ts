import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeSignal } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// GET /api/sources/hackernews -> Hacker News-origin signals.
export async function GET() {
  const signals = await prisma.rawSignal.findMany({
    where: { source: "hackernews" },
    orderBy: { engagementScore: "desc" },
  });
  return NextResponse.json({ source: "hackernews", count: signals.length, signals: signals.map(serializeSignal) });
}
