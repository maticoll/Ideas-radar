import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { runCollection, runRanking } from "@/lib/pipeline";
import { refreshAllowed } from "@/lib/auth";
import { OPPORTUNITIES_TAG } from "@/lib/reads";

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
  revalidateTag(OPPORTUNITIES_TAG); // push the new ranking to cached reads now
  return NextResponse.json({ collected, ranked, ranAt: new Date().toISOString() });
}
