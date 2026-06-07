-- CreateEnum
CREATE TYPE "UniversityType" AS ENUM ('public', 'private', 'international');

-- CreateEnum
CREATE TYPE "Designation" AS ENUM ('lecturer', 'assistant_professor', 'associate_professor', 'professor', 'adjunct', 'other');

-- CreateEnum
CREATE TYPE "ProfessorStatus" AS ENUM ('active', 'retired', 'unverified');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('live', 'soft_flagged', 'flagged_hidden', 'deleted');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('visible', 'hidden', 'deleted');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('personal', 'fake', 'offensive', 'wrong_professor', 'other');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('pending', 'resolved_kept', 'resolved_removed');

-- CreateTable
CREATE TABLE "universities" (
    "id" SERIAL NOT NULL,
    "name_en" VARCHAR(200) NOT NULL,
    "name_bn" VARCHAR(200),
    "short_name" VARCHAR(20) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "location_city" VARCHAR(100),
    "type" "UniversityType" NOT NULL,
    "website_url" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "university_id" INTEGER NOT NULL,
    "name_en" VARCHAR(200) NOT NULL,
    "name_bn" VARCHAR(200),
    "short_name" VARCHAR(20),
    "slug" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professors" (
    "id" SERIAL NOT NULL,
    "university_id" INTEGER NOT NULL,
    "department_id" INTEGER NOT NULL,
    "name_en" VARCHAR(200) NOT NULL,
    "name_bn" VARCHAR(200),
    "designation" "Designation",
    "status" "ProfessorStatus" NOT NULL DEFAULT 'unverified',
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "professors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "course_code" VARCHAR(20),
    "course_name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professor_courses" (
    "id" SERIAL NOT NULL,
    "professor_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "avg_teaching_quality" DECIMAL(3,2),
    "avg_grading_fairness" DECIMAL(3,2),
    "avg_course_difficulty" DECIMAL(3,2),
    "avg_attendance" DECIMAL(3,2),
    "would_recommend_pct" DECIMAL(5,2),
    "overall_score" DECIMAL(3,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professor_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" SERIAL NOT NULL,
    "professor_course_id" INTEGER NOT NULL,
    "teaching_quality" SMALLINT NOT NULL,
    "grading_fairness" SMALLINT NOT NULL,
    "course_difficulty" SMALLINT NOT NULL,
    "attendance_strictness" SMALLINT NOT NULL,
    "would_recommend" BOOLEAN NOT NULL,
    "review_text" TEXT,
    "tags" TEXT[],
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'live',
    "moderation_reason" VARCHAR(200),
    "moderation_notes" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'visible',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_submissions" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "professor_course_id" INTEGER NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "google_id" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "helpful_votes" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "review_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "helpful_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" SERIAL NOT NULL,
    "review_id" INTEGER NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'pending',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" TIMESTAMP(3),

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "universities_name_en_key" ON "universities"("name_en");

-- CreateIndex
CREATE UNIQUE INDEX "universities_short_name_key" ON "universities"("short_name");

-- CreateIndex
CREATE UNIQUE INDEX "universities_slug_key" ON "universities"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "departments_university_id_short_name_key" ON "departments"("university_id", "short_name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_university_id_slug_key" ON "departments"("university_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "professors_slug_key" ON "professors"("slug");

-- CreateIndex
CREATE INDEX "professors_university_id_department_id_idx" ON "professors"("university_id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_department_id_course_code_key" ON "courses"("department_id", "course_code");

-- CreateIndex
CREATE UNIQUE INDEX "professor_courses_professor_id_course_id_key" ON "professor_courses"("professor_id", "course_id");

-- CreateIndex
CREATE INDEX "reviews_by_helpful_idx" ON "reviews"("professor_course_id", "helpful_count" DESC);

-- CreateIndex
CREATE INDEX "reviews_by_recent_idx" ON "reviews"("professor_course_id", "submitted_at" DESC);

-- CreateIndex
CREATE INDEX "reviews_moderation_idx" ON "reviews"("moderation_status");

-- CreateIndex
CREATE UNIQUE INDEX "review_submissions_user_id_professor_course_id_key" ON "review_submissions"("user_id", "professor_course_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "helpful_votes_user_id_review_id_key" ON "helpful_votes"("user_id", "review_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_username_key" ON "admin_users"("username");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professors" ADD CONSTRAINT "professors_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professors" ADD CONSTRAINT "professors_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_courses" ADD CONSTRAINT "professor_courses_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "professors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_courses" ADD CONSTRAINT "professor_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_professor_course_id_fkey" FOREIGN KEY ("professor_course_id") REFERENCES "professor_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_submissions" ADD CONSTRAINT "review_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_submissions" ADD CONSTRAINT "review_submissions_professor_course_id_fkey" FOREIGN KEY ("professor_course_id") REFERENCES "professor_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helpful_votes" ADD CONSTRAINT "helpful_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helpful_votes" ADD CONSTRAINT "helpful_votes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
