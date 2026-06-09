import { NextResponse } from "next/server";
import { getTodayTop } from "@/lib/reads";

export const dynamic = "force-dynamic";

// GET /api/ideas/today -> the top 5 validated opportunities for today (cached).
export async function GET() {
  const ideas = await getTodayTop();
  return NextResponse.json({
    date: new Date().toISOString().slice(0, 10),
    count: ideas.length,
    ideas,
  });
}
