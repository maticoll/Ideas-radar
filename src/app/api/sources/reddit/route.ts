import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeSignal } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// GET /api/sources/reddit -> Reddit-origin signals.
export async function GET() {
  const signals = await prisma.rawSignal.findMany({
    where: { source: "reddit" },
    orderBy: { engagementScore: "desc" },
  });
  return NextResponse.json({ source: "reddit", count: signals.length, signals: signals.map(serializeSignal) });
}
