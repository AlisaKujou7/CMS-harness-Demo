-- CreateEnum
CREATE TYPE "variant_status" AS ENUM ('pending', 'ready', 'failed', 'none');

-- AlterTable
ALTER TABLE "content" ADD COLUMN     "referenced_media_ids" UUID[] DEFAULT ARRAY[]::UUID[];

-- CreateTable
CREATE TABLE "media_items" (
    "id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "alt_text" TEXT,
    "caption" TEXT,
    "variants" JSONB NOT NULL,
    "variant_status" "variant_status" NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_items_storage_key_key" ON "media_items"("storage_key");

-- CreateIndex
CREATE INDEX "media_items_created_at_idx" ON "media_items"("created_at" DESC);

-- CreateIndex
CREATE INDEX "media_items_uploaded_by_idx" ON "media_items"("uploaded_by");

-- CreateIndex
CREATE INDEX "media_items_variant_status_created_at_idx" ON "media_items"("variant_status", "created_at");

-- CreateIndex
CREATE INDEX "content_referenced_media_ids_idx" ON "content" USING GIN ("referenced_media_ids");

-- CreateIndex
CREATE INDEX "content_featured_image_id_idx" ON "content"("featured_image_id");

-- CreateIndex
CREATE INDEX "content_social_image_id_idx" ON "content"("social_image_id");

-- AddForeignKey
ALTER TABLE "content" ADD CONSTRAINT "content_featured_image_id_fkey" FOREIGN KEY ("featured_image_id") REFERENCES "media_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content" ADD CONSTRAINT "content_social_image_id_fkey" FOREIGN KEY ("social_image_id") REFERENCES "media_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
