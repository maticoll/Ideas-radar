import { NextResponse } from "next/server";
import { runCollection } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST/GET /api/cron/collect — the 6-hourly collection job.
// Protect with: Authorization: Bearer <CRON_SECRET>
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // open in local dev if unset
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runCollection();
  return NextResponse.json({ job: "collect", ranAt: new Date().toISOString(), result });
}

export const GET = handle;
export const POST = handle;
