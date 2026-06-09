-- CreateEnum
CREATE TYPE "DepartmentStatus" AS ENUM ('verified', 'unverified');

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "status" "DepartmentStatus" NOT NULL DEFAULT 'unverified';
