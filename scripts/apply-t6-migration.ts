// One-shot: apply the T6 migration over the Neon HTTP driver (port 443),
// for networks where the Prisma CLI can't reach Postgres on 5432.
import { prisma } from "../src/lib/db";

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "cluster_key" TEXT');
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "opportunities_cluster_key_key" ON "opportunities"("cluster_key")',
  );
  console.log("[migrate] t6_cluster_key applied over HTTP");
}

main().then(() => process.exit(0));
