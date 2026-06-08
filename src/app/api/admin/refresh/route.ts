import { NextResponse } from "next/server";
import { runCollection, runRanking } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const collected = await runCollection();
  const ranked = await runRanking();
  return NextResponse.json({ collected, ranked, ranAt: new Date().toISOString() });
}
