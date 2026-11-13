-- CreateEnum
CREATE TYPE "content_type" AS ENUM ('article', 'page');

-- CreateEnum
CREATE TYPE "content_status" AS ENUM ('draft', 'in_review', 'published', 'unpublished', 'archived');

-- CreateTable
CREATE TABLE "content" (
    "id" UUID NOT NULL,
    "type" "content_type" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "status" "content_status" NOT NULL,
    "author_id" UUID NOT NULL,
    "featured_image_id" UUID,
    "social_image_id" UUID,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "tags" TEXT[],
    "category" TEXT,
    "parent_id" UUID,
    "scheduled_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "review_note" TEXT,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_versions" (
    "id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "editor_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_status_published_at_idx" ON "content"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "content_author_id_status_idx" ON "content"("author_id", "status");

-- CreateIndex
CREATE INDEX "content_tags_idx" ON "content" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "content_scheduled_at_idx" ON "content"("scheduled_at");

-- CreateIndex
CREATE INDEX "content_deleted_at_idx" ON "content"("deleted_at");

-- CreateIndex
CREATE INDEX "content_parent_id_idx" ON "content"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_type_slug_key" ON "content"("type", "slug");

-- CreateIndex
CREATE INDEX "content_versions_editor_id_idx" ON "content_versions"("editor_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_versions_content_id_version_no_key" ON "content_versions"("content_id", "version_no");

-- AddForeignKey
ALTER TABLE "content" ADD CONSTRAINT "content_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content" ADD CONSTRAINT "content_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_editor_id_fkey" FOREIGN KEY ("editor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
