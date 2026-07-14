-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('super_admin', 'admin', 'moderator');

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "email" VARCHAR(255),
ADD COLUMN     "role" "AdminRole" NOT NULL DEFAULT 'moderator';

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");


-- Enforce "at most one super_admin" via a partial unique index. Postgres
-- treats NULLs as distinct so this is only ever tripped when we try to
-- INSERT/UPDATE a second row into the super_admin bucket.
CREATE UNIQUE INDEX "admin_users_only_one_super_admin"
  ON "admin_users" ((role))
  WHERE role = 'super_admin';

-- Promote the seed-created bootstrap admin (username='admin') to super_admin.
-- Idempotent: affects zero rows on a fresh DB, one row on any DB that ran
-- the previous seed. If you deploy against a fresh DB, the seed script
-- itself is responsible for creating the initial super_admin row.
UPDATE "admin_users" SET role = 'super_admin' WHERE username = 'admin';
