-- CreateEnum
CREATE TYPE "UniversityRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "university_requests" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "name_en" VARCHAR(200) NOT NULL,
    "name_bn" VARCHAR(200),
    "type" "UniversityType" NOT NULL,
    "status" "UniversityRequestStatus" NOT NULL DEFAULT 'pending',
    "admin_note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "university_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "university_requests_status_idx" ON "university_requests"("status");

-- AddForeignKey
ALTER TABLE "university_requests" ADD CONSTRAINT "university_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
