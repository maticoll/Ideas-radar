import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { runRanking } from "@/lib/pipeline";
import { isAuthorized } from "@/lib/auth";
import { OPPORTUNITIES_TAG } from "@/lib/reads";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST/GET /api/cron/rank — the daily ranking job (cluster + score + rank).
// Protect with: Authorization: Bearer <CRON_SECRET>. Fail-closed in production.
async function handle(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runRanking();
  revalidateTag(OPPORTUNITIES_TAG); // refresh cached reads with the new ranking
  return NextResponse.json({ job: "rank", ranAt: new Date().toISOString(), result });
}

export const GET = handle;
export const POST = handle;
