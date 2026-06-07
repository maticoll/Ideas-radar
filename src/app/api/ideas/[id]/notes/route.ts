import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";

export const dynamic = "force-dynamic";

// POST /api/ideas/:id/notes  body: { notes: string }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const body = await req.json().catch(() => ({}));
  const notes = typeof body.notes === "string" ? body.notes : "";

  const opp = await prisma.opportunity.findUnique({ where: { id: params.id } });
  if (!opp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const saved = await prisma.savedIdea.upsert({
    where: { userId_opportunityId: { userId: user.id, opportunityId: opp.id } },
    update: { notes },
    create: { userId: user.id, opportunityId: opp.id, notes, status: "research" },
  });
  return NextResponse.json({ id: opp.id, notes: saved.notes });
}
