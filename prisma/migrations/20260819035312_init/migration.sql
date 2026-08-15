-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('OLD', 'NEW');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('SAVINGS', 'CURRENT', 'CASH', 'WALLET');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('EQUITY', 'MUTUAL_FUND', 'ETF', 'BOND', 'FD', 'RD', 'EPF', 'PPF', 'NPS', 'GOLD_PHYSICAL', 'GOLD_DIGITAL', 'SGB', 'REAL_ESTATE', 'VEHICLE', 'CRYPTO', 'OTHER');

-- CreateEnum
CREATE TYPE "LiabilityType" AS ENUM ('HOME_LOAN', 'PERSONAL_LOAN', 'CAR_LOAN', 'EDUCATION_LOAN', 'CREDIT_CARD', 'BNPL', 'INFORMAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PrepaymentMode" AS ENUM ('REDUCE_TENURE', 'REDUCE_EMI');

-- CreateEnum
CREATE TYPE "CommitmentDirection" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "CommitmentCategory" AS ENUM ('SALARY', 'RENT', 'EMI', 'SIP', 'INSURANCE', 'UTILITY', 'SUBSCRIPTION', 'CREDIT_CARD_BILL', 'TAX', 'OTHER');

-- CreateEnum
CREATE TYPE "CommitmentFrequency" AS ENUM ('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "VariableSpendSource" AS ENUM ('USER_ESTIMATE', 'DERIVED');

-- CreateEnum
CREATE TYPE "ScenarioType" AS ENUM ('PREPAY_VS_INVEST', 'AFFORDABILITY', 'INCOME_CHANGE', 'JOB_LOSS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "taxSlabPercent" DECIMAL(6,3) NOT NULL,
    "taxRegime" "TaxRegime" NOT NULL DEFAULT 'NEW',
    "salaryDayOfMonth" INTEGER,
    "emergencyFundTargetMonths" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "currentBalance" DECIMAL(18,4) NOT NULL,
    "isJoint" BOOLEAN NOT NULL DEFAULT false,
    "balanceAsOf" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "investedAmount" DECIMAL(18,4) NOT NULL,
    "currentValue" DECIMAL(18,4) NOT NULL,
    "valuationAsOf" TIMESTAMP(3) NOT NULL,
    "expectedAnnualReturnPercent" DECIMAL(6,3),
    "isJoint" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Liability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LiabilityType" NOT NULL,
    "principalAmount" DECIMAL(18,4) NOT NULL,
    "annualInterestRatePercent" DECIMAL(6,3) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "tenureMonths" INTEGER NOT NULL,
    "emiAmount" DECIMAL(18,4) NOT NULL,
    "emiDayOfMonth" INTEGER NOT NULL,
    "outstandingPrincipal" DECIMAL(18,4) NOT NULL,
    "outstandingAsOf" TIMESTAMP(3) NOT NULL,
    "prepaymentPenaltyPercent" DECIMAL(6,3),
    "isTaxDeductible" BOOLEAN NOT NULL DEFAULT false,
    "isSelfOccupied" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Liability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prepayment" (
    "id" TEXT NOT NULL,
    "liabilityId" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mode" "PrepaymentMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commitment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" "CommitmentDirection" NOT NULL,
    "category" "CommitmentCategory" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "isVariable" BOOLEAN NOT NULL DEFAULT false,
    "frequency" "CommitmentFrequency" NOT NULL,
    "anchorDate" TIMESTAMP(3) NOT NULL,
    "dayOfMonth" INTEGER,
    "endDate" TIMESTAMP(3),
    "linkedLiabilityId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariableSpendBaseline" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthlyAmount" DECIMAL(18,4) NOT NULL,
    "source" "VariableSpendSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariableSpendBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmount" DECIMAL(18,4) NOT NULL,
    "currentAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "monthlyContribution" DECIMAL(18,4) NOT NULL,
    "expectedAnnualReturnPercent" DECIMAL(6,3) NOT NULL,
    "inflationPercent" DECIMAL(6,3) NOT NULL DEFAULT 6.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ScenarioType" NOT NULL,
    "inputsJson" JSONB NOT NULL,
    "resultJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Asset_userId_idx" ON "Asset"("userId");

-- CreateIndex
CREATE INDEX "Liability_userId_idx" ON "Liability"("userId");

-- CreateIndex
CREATE INDEX "Prepayment_liabilityId_idx" ON "Prepayment"("liabilityId");

-- CreateIndex
CREATE INDEX "Commitment_userId_idx" ON "Commitment"("userId");

-- CreateIndex
CREATE INDEX "Commitment_anchorDate_idx" ON "Commitment"("anchorDate");

-- CreateIndex
CREATE INDEX "Commitment_linkedLiabilityId_idx" ON "Commitment"("linkedLiabilityId");

-- CreateIndex
CREATE UNIQUE INDEX "VariableSpendBaseline_userId_key" ON "VariableSpendBaseline"("userId");

-- CreateIndex
CREATE INDEX "Goal_userId_idx" ON "Goal"("userId");

-- CreateIndex
CREATE INDEX "Scenario_userId_idx" ON "Scenario"("userId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liability" ADD CONSTRAINT "Liability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prepayment" ADD CONSTRAINT "Prepayment_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "Liability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_linkedLiabilityId_fkey" FOREIGN KEY ("linkedLiabilityId") REFERENCES "Liability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariableSpendBaseline" ADD CONSTRAINT "VariableSpendBaseline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
