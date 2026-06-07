import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeSignal } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// GET /api/signals?source=&category=&minPain=&limit=
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source") || undefined;
  const category = searchParams.get("category") || undefined;
  const minPain = Number(searchParams.get("minPain") || 0);
  const limit = Math.min(Number(searchParams.get("limit") || 100), 500);

  const signals = await prisma.rawSignal.findMany({
    where: {
      ...(source ? { source } : {}),
      ...(category ? { category } : {}),
      painScore: { gte: minPain },
    },
    orderBy: { collectedAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ count: signals.length, signals: signals.map(serializeSignal) });
}
