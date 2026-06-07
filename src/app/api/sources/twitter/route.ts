import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeSignal } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// GET /api/sources/twitter -> Twitter/X-origin signals.
export async function GET() {
  const signals = await prisma.rawSignal.findMany({
    where: { source: "twitter" },
    orderBy: { engagementScore: "desc" },
  });
  return NextResponse.json({ source: "twitter", count: signals.length, signals: signals.map(serializeSignal) });
}
