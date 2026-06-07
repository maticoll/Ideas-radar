import { NextResponse } from "next/server";
import { runSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST/GET /api/seed — populate the (production) DB with demo data, once.
// Protect with: Authorization: Bearer <CRON_SECRET>
// Example: curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/seed
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // open if unset (local dev)
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runSeed();
  return NextResponse.json({ seeded: true, ranAt: new Date().toISOString(), result });
}

export const GET = handle;
export const POST = handle;
