import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";

export const dynamic = "force-dynamic";

// POST /api/ideas/:id/save -> toggle/save an idea to favorites.
// body (optional): { status?: string, notes?: string }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const opp = await prisma.opportunity.findUnique({ where: { id: params.id } });
  if (!opp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { status?: string; notes?: string; toggle?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }

  const existing = await prisma.savedIdea.findFirst({
    where: { userId: user.id, opportunityId: opp.id },
  });

  if (existing && body.toggle) {
    await prisma.savedIdea.delete({ where: { id: existing.id } });
    return NextResponse.json({ saved: false });
  }

  const saved = await prisma.savedIdea.upsert({
    where: { userId_opportunityId: { userId: user.id, opportunityId: opp.id } },
    update: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.notes != null ? { notes: body.notes } : {}),
    },
    create: {
      userId: user.id,
      opportunityId: opp.id,
      status: body.status || "research",
      notes: body.notes || "",
    },
  });

  return NextResponse.json({ saved: true, status: saved.status, notes: saved.notes });
}
