-- A soft-deleted item gives up its slug, so only live rows must be unique.
DROP INDEX "content_type_slug_key";

CREATE UNIQUE INDEX "content_type_slug_live_key" ON "content"("type", "slug") WHERE "deleted_at" IS NULL;

CREATE INDEX "content_type_slug_idx" ON "content"("type", "slug");
