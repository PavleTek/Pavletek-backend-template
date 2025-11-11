-- AlterTable
ALTER TABLE "User" ADD COLUMN     "userEnabledTwoFactor" BOOLEAN NOT NULL DEFAULT false;

-- Remove backup codes column
ALTER TABLE "User" DROP COLUMN "twoFactorBackupCodes";

-- Set userEnabledTwoFactor = true for users who currently have 2FA set up
-- This preserves existing user preferences
UPDATE "User" 
SET "userEnabledTwoFactor" = true 
WHERE "twoFactorEnabled" = true AND "twoFactorSecret" IS NOT NULL;

