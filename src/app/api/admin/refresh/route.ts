import { NextResponse } from "next/server";
import { runCollection, runRanking } from "@/lib/pipeline";
import { refreshAllowed } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/admin/refresh — runs the full pipeline (collect + rank).
// Protected: requires a valid CRON_SECRET bearer, unless ALLOW_PUBLIC_REFRESH=true
// or running in local dev. See src/lib/auth.ts.
export async function POST(req: Request) {
  if (!refreshAllowed(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const collected = await runCollection();
  const ranked = await runRanking();
  return NextResponse.json({ collected, ranked, ranAt: new Date().toISOString() });
}
