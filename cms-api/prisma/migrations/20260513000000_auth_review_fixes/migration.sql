-- AlterTable
ALTER TABLE "login_lockouts" DROP COLUMN "failure_count",
DROP COLUMN "window_started_at",
ADD COLUMN     "failure_times" TIMESTAMPTZ(3)[];

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "rotated_at" TIMESTAMPTZ(3);
