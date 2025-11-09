-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordResetCode" TEXT,
ADD COLUMN     "passwordResetCodeExpires" TIMESTAMP(3);
