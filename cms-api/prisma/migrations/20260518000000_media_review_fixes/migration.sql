-- CreateTable
CREATE TABLE "media_file_deletions" (
    "key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_file_deletions_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "media_file_deletions_created_at_idx" ON "media_file_deletions"("created_at");
