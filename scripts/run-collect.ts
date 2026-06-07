// Standalone runner for the 6-hourly collection job (use with system cron,
// GitHub Actions, or a worker). Example crontab: 0 */6 * * *
import { prisma } from "../src/lib/db";
import { runCollection } from "../src/lib/pipeline";

runCollection()
  .then((r) => console.log("[cron:collect]", r))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
