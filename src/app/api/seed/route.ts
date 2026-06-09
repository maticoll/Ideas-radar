import { NextResponse } from "next/server";
import { runSeed } from "@/lib/seed";
import { isAuthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST/GET /api/seed — populate the (production) DB with demo data, once.
// Protect with: Authorization: Bearer <CRON_SECRET>. Fail-closed in production.
// Example: curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/seed
async function handle(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runSeed();
  return NextResponse.json({ seeded: true, ranAt: new Date().toISOString(), result });
}

export const GET = handle;
export const POST = handle;
