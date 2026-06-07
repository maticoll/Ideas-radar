-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_signals" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_author" TEXT,
    "text" TEXT NOT NULL,
    "engagement_score" INTEGER NOT NULL DEFAULT 0,
    "created_at_source" TIMESTAMP(3) NOT NULL,
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "language" TEXT NOT NULL DEFAULT 'en',
    "category" TEXT NOT NULL,
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "pain_score" INTEGER NOT NULL DEFAULT 0,
    "payment_intent_score" INTEGER NOT NULL DEFAULT 0,
    "matched_pattern" TEXT,

    CONSTRAINT "raw_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_hunt_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "launch_date" TIMESTAMP(3) NOT NULL,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "comments_count" INTEGER NOT NULL DEFAULT 0,
    "last_activity_date" TIMESTAMP(3) NOT NULL,
    "abandoned_score" INTEGER NOT NULL DEFAULT 0,
    "active_review_score" INTEGER NOT NULL DEFAULT 0,
    "site_status" TEXT NOT NULL DEFAULT 'unknown',
    "category" TEXT NOT NULL,

    CONSTRAINT "product_hunt_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trends" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'Worldwide',
    "trend_score" INTEGER NOT NULL DEFAULT 0,
    "growth_12m" INTEGER NOT NULL DEFAULT 0,
    "related_queries" TEXT NOT NULL DEFAULT '[]',
    "series" TEXT NOT NULL DEFAULT '[]',
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "why_now" TEXT NOT NULL DEFAULT '',
    "evidence" TEXT NOT NULL DEFAULT '',
    "gap" TEXT NOT NULL,
    "mvp" TEXT NOT NULL,
    "business_model" TEXT NOT NULL,
    "competitors" TEXT NOT NULL DEFAULT '[]',
    "category" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'Worldwide',
    "segment" TEXT NOT NULL DEFAULT 'B2C',
    "demand_score" INTEGER NOT NULL DEFAULT 0,
    "pain_score" INTEGER NOT NULL DEFAULT 0,
    "payment_intent_score" INTEGER NOT NULL DEFAULT 0,
    "trend_score" INTEGER NOT NULL DEFAULT 0,
    "competition_score" INTEGER NOT NULL DEFAULT 0,
    "execution_score" INTEGER NOT NULL DEFAULT 0,
    "final_score" INTEGER NOT NULL DEFAULT 0,
    "score_breakdown" TEXT NOT NULL DEFAULT '{}',
    "trend_keyword" TEXT,
    "rank_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previous_rank" INTEGER,
    "rank" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_signals" (
    "id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "raw_signal_id" TEXT NOT NULL,

    CONSTRAINT "opportunity_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_ideas" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'research',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_ideas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "raw_signals_source_idx" ON "raw_signals"("source");

-- CreateIndex
CREATE INDEX "raw_signals_category_idx" ON "raw_signals"("category");

-- CreateIndex
CREATE INDEX "opportunities_category_idx" ON "opportunities"("category");

-- CreateIndex
CREATE INDEX "opportunities_final_score_idx" ON "opportunities"("final_score");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_signals_opportunity_id_raw_signal_id_key" ON "opportunity_signals"("opportunity_id", "raw_signal_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_ideas_user_id_opportunity_id_key" ON "saved_ideas"("user_id", "opportunity_id");

-- AddForeignKey
ALTER TABLE "opportunity_signals" ADD CONSTRAINT "opportunity_signals_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_signals" ADD CONSTRAINT "opportunity_signals_raw_signal_id_fkey" FOREIGN KEY ("raw_signal_id") REFERENCES "raw_signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_ideas" ADD CONSTRAINT "saved_ideas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_ideas" ADD CONSTRAINT "saved_ideas_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

