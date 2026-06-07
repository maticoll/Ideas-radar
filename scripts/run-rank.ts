// Standalone runner for the daily ranking job. Example crontab: 0 7 * * *
import { prisma } from "../src/lib/db";
import { runRanking } from "../src/lib/pipeline";

runRanking()
  .then((r) => console.log("[cron:rank]", r))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
