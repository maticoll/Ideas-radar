-- T6: stable cluster identity for opportunities (blueprint key or semantic
-- cluster key). Idempotent on purpose: this migration is applied over the
-- Neon HTTP driver on networks where port 5432 is blocked, and recorded by
-- `prisma migrate deploy` later without erroring on re-apply.
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "cluster_key" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "opportunities_cluster_key_key" ON "opportunities"("cluster_key");
