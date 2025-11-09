-- AlterTable
ALTER TABLE "Configuration" ADD COLUMN     "recoveryEmailSenderId" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twoFactorRecoveryCode" TEXT,
ADD COLUMN     "twoFactorRecoveryCodeExpires" TIMESTAMP(3);
