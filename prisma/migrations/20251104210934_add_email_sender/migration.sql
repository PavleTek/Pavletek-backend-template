-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('GMAIL', 'OUTLOOK');

-- CreateTable
CREATE TABLE "EmailSender" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "emailProvider" "EmailProvider" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSender_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailSender_email_key" ON "EmailSender"("email");
