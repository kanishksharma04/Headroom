-- CreateEnum
CREATE TYPE "LoginAttemptKind" AS ENUM ('CREDENTIALS', 'TOTP');

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "kind" "LoginAttemptKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginAttempt_email_kind_createdAt_idx" ON "LoginAttempt"("email", "kind", "createdAt");
