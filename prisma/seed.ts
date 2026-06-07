// Seed: runs the real engine pipeline so demo data is produced exactly the way
// production would produce it (collect -> normalize -> cluster -> score -> rank),
// then adds a demo user with a few saved ideas, notes and statuses.

import { prisma } from "../src/lib/db";
import { runCollection, runRanking } from "../src/lib/pipeline";

async function main() {
  console.log("→ Seeding Idea Radar…");

  // Clean slate (order matters for FKs).
  await prisma.savedIdea.deleteMany();
  await prisma.opportunitySignal.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.rawSignal.deleteMany();
  await prisma.productHuntProduct.deleteMany();
  await prisma.trend.deleteMany();
  await prisma.user.deleteMany();

  // Demo user.
  const user = await prisma.user.create({
    data: { name: "Corea", email: "demo@idearadar.app" },
  });
  console.log(`  ✓ user: ${user.email}`);

  // Run the actual pipeline (uses demo collectors).
  const collection = await runCollection();
  console.log("  ✓ collection:", collection);

  const ranking = await runRanking();
  console.log("  ✓ ranking:", ranking);

  // Save a few ideas for the demo user with statuses + notes.
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
  console.log("  ✓ final counts:", counts);
  console.log("✔ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
