// CLI seed entrypoint. Delegates to the shared runSeed routine.
import { prisma } from "../src/lib/db";
import { runSeed } from "../src/lib/seed";

runSeed()
  .then((r) => {
    console.log("→ Seeding Idea Radar…");
    console.log("  ✓ collection:", r.collection);
    console.log("  ✓ ranking:", r.ranking);
    console.log("  ✓ final counts:", r.counts);
    console.log("✔ Seed complete.");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
