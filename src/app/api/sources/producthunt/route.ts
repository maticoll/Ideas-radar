import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/sources/producthunt -> abandoned products with residual demand.
export async function GET() {
  const products = await prisma.productHuntProduct.findMany({
    orderBy: { abandonedScore: "desc" },
  });
  return NextResponse.json({ source: "producthunt", count: products.length, products });
}
