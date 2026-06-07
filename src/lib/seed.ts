// Shared seed routine. Used by prisma/seed.ts (CLI) and /api/seed (Vercel).
// Runs the real engine pipeline so demo data is produced exactly as production
// would, then adds a demo user with a few saved ideas, notes and statuses.

import { prisma } from "./db";
import { runCollection, runRanking } from "./pipeline";

export async function runSeed() {
  // Clean slate (order matters for FKs).
  await prisma.savedIdea.deleteMany();
  await prisma.opportunitySignal.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.rawSignal.deleteMany();
  await prisma.productHuntProduct.deleteMany();
  await prisma.trend.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: { name: "Corea", email: "demo@idearadar.app" },
  });

  const collection = await runCollection();
  const ranking = await runRanking();

  const top = await prisma.opportunity.findMany({ orderBy: { finalScore: "desc" }, take: 5 });
  if (top[0]) {
    await prisma.savedIdea.create({
      data: {
        userId: user.id,
        opportunityId: top[0].id,
        status: "build",
        notes: "Mejor encaje con mi experiencia. Validar pricing con 5 freelancers esta semana.",
      },
    });
  }
  if (top[2]) {
    await prisma.savedIdea.create({
      data: {
        userId: user.id,
        opportunityId: top[2].id,
        status: "validate",
        notes: "Buscar a los usuarios del producto abandonado y entrevistarlos.",
      },
    });
  }
  if (top[4]) {
    await prisma.savedIdea.create({
      data: {
        userId: user.id,
        opportunityId: top[4].id,
        status: "research",
        notes: "Revisar tamaño de mercado y competencia.",
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    rawSignals: await prisma.rawSignal.count(),
    products: await prisma.productHuntProduct.count(),
    trends: await prisma.trend.count(),
    opportunities: await prisma.opportunity.count(),
    savedIdeas: await prisma.savedIdea.count(),
  };

  return { collection, ranking, counts };
}
