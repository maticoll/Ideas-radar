import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";

export const dynamic = "force-dynamic";

const VALID = ["research", "validate", "discard", "build"];

// POST /api/ideas/:id/status  body: { status: "research"|"validate"|"discard"|"build" }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const body = await req.json().catch(() => ({}));
  const status = body.status;
  if (!VALID.includes(status)) {
    return NextResponse.json({ error: `status must be one of ${VALID.join(", ")}` }, { status: 400 });
  }
  const opp = await prisma.opportunity.findUnique({ where: { id: params.id } });
  if (!opp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const saved = await prisma.savedIdea.upsert({
    where: { userId_opportunityId: { userId: user.id, opportunityId: opp.id } },
    update: { status },
    create: { userId: user.id, opportunityId: opp.id, status },
  });
  return NextResponse.json({ id: opp.id, status: saved.status });
}
