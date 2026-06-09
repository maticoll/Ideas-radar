-- T4 — data model: ranking history, indexes, JSON -> JSONB.
--
-- The JSON columns were created as TEXT (portable JSON strings). Postgres will
-- not auto-cast TEXT to JSONB, so each conversion drops the text default, casts
-- the existing rows with `USING "<col>"::jsonb`, and re-adds the JSON default.
-- Data is preserved (the stored strings are already valid JSON).

-- 4.2 — indexes on raw_signals (time-window queries + dedupe by URL)
CREATE INDEX "raw_signals_collected_at_idx" ON "raw_signals"("collected_at");
CREATE INDEX "raw_signals_source_url_idx" ON "raw_signals"("source_url");

-- 4.3 — JSON (TEXT) -> JSONB, converting existing data in place
ALTER TABLE "raw_signals" ALTER COLUMN "keywords" DROP DEFAULT;
ALTER TABLE "raw_signals" ALTER COLUMN "keywords" SET DATA TYPE JSONB USING "keywords"::jsonb;
ALTER TABLE "raw_signals" ALTER COLUMN "keywords" SET DEFAULT '[]';

ALTER TABLE "trends" ALTER COLUMN "related_queries" DROP DEFAULT;
ALTER TABLE "trends" ALTER COLUMN "related_queries" SET DATA TYPE JSONB USING "related_queries"::jsonb;
ALTER TABLE "trends" ALTER COLUMN "related_queries" SET DEFAULT '[]';

ALTER TABLE "trends" ALTER COLUMN "series" DROP DEFAULT;
ALTER TABLE "trends" ALTER COLUMN "series" SET DATA TYPE JSONB USING "series"::jsonb;
ALTER TABLE "trends" ALTER COLUMN "series" SET DEFAULT '[]';

ALTER TABLE "opportunities" ALTER COLUMN "competitors" DROP DEFAULT;
ALTER TABLE "opportunities" ALTER COLUMN "competitors" SET DATA TYPE JSONB USING "competitors"::jsonb;
ALTER TABLE "opportunities" ALTER COLUMN "competitors" SET DEFAULT '[]';

ALTER TABLE "opportunities" ALTER COLUMN "score_breakdown" DROP DEFAULT;
ALTER TABLE "opportunities" ALTER COLUMN "score_breakdown" SET DATA TYPE JSONB USING "score_breakdown"::jsonb;
ALTER TABLE "opportunities" ALTER COLUMN "score_breakdown" SET DEFAULT '{}';

-- 4.1 — ranking history snapshots
CREATE TABLE "ranking_snapshots" (
    "id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "final_score" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ranking_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ranking_snapshots_opportunity_id_date_idx" ON "ranking_snapshots"("opportunity_id", "date");

ALTER TABLE "ranking_snapshots" ADD CONSTRAINT "ranking_snapshots_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
