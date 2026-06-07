import { NextResponse } from "next/server";
import { runRanking } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST/GET /api/cron/rank — the daily ranking job (cluster + score + rank).
// Protect with: Authorization: Bearer <CRON_SECRET>
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runRanking();
  return NextResponse.json({ job: "rank", ranAt: new Date().toISOString(), result });
}

export const GET = handle;
export const POST = handle;
