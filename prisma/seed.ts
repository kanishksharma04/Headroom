import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { registerUser } from "@/lib/services/auth-service";
import { updateUser } from "@/lib/repositories/user-repository";
import { addAccountForUser } from "@/lib/services/account-service";
import { addAssetForUser } from "@/lib/services/asset-service";
import { addLiabilityForUser } from "@/lib/services/liability-service";
import { addCommitmentForUser } from "@/lib/services/commitment-service";
import { setVariableSpendBaselineForUser } from "@/lib/services/variable-spend-service";
import { createGoal } from "@/lib/repositories/goal-repository";
import { istDate, todayIst } from "@/lib/dates";

const DEMO_EMAIL = "demo@headroom.app";
const DEMO_PASSWORD = "headroom-demo";

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    console.log(`Removing existing demo user (${DEMO_EMAIL}) before reseeding…`);
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const user = await registerUser({
    name: "Demo User",
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  await updateUser(user.id, { salaryDayOfMonth: 1, taxRegime: "OLD" });
  console.log(`Created user ${user.email} (${user.id})`);

  const today = todayIst();

  // Liquid balances — ₹1,20,000 across two accounts.
  await addAccountForUser(user.id, {
    name: "HDFC Savings",
    type: "SAVINGS",
    currentBalance: "85000",
    isJoint: false,
    balanceAsOf: today,
  });
  await addAccountForUser(user.id, {
    name: "ICICI Current",
    type: "CURRENT",
    currentBalance: "35000",
    isJoint: false,
    balanceAsOf: today,
  });

  // Home loan — ₹38.4L outstanding at 8.6%. EMI hand-verified against
  // lib/engines/amortisation.test.ts for a ₹40L / 8.6% / 240m loan.
  await addLiabilityForUser(user.id, {
    name: "Home Loan",
    type: "HOME_LOAN",
    principalAmount: "4000000",
    annualInterestRatePercent: "8.6",
    startDate: istDate(2023, 7, 5),
    tenureMonths: 240,
    emiAmount: "34966.51",
    emiDayOfMonth: 5,
    outstandingPrincipal: "3840000",
    outstandingAsOf: today,
    prepaymentPenaltyPercent: undefined,
    isTaxDeductible: true,
    isSelfOccupied: true,
    isJoint: true,
  });

  // Income.
  await addCommitmentForUser(user.id, {
    name: "Salary",
    direction: "INFLOW",
    category: "SALARY",
    amount: "95000",
    isVariable: false,
    frequency: "MONTHLY",
    anchorDate: istDate(2026, 7, 1),
    dayOfMonth: 1,
    endDate: undefined,
  });

  // Rent.
  await addCommitmentForUser(user.id, {
    name: "Rent",
    direction: "OUTFLOW",
    category: "RENT",
    amount: "32000",
    isVariable: false,
    frequency: "MONTHLY",
    anchorDate: istDate(2026, 7, 3),
    dayOfMonth: 3,
    endDate: undefined,
  });

  // Two SIPs.
  await addCommitmentForUser(user.id, {
    name: "Nifty 50 Index SIP",
    direction: "OUTFLOW",
    category: "SIP",
    amount: "10000",
    isVariable: false,
    frequency: "MONTHLY",
    anchorDate: istDate(2026, 7, 7),
    dayOfMonth: 7,
    endDate: undefined,
  });
  await addCommitmentForUser(user.id, {
    name: "Flexicap Fund SIP",
    direction: "OUTFLOW",
    category: "SIP",
    amount: "5000",
    isVariable: false,
    frequency: "MONTHLY",
    anchorDate: istDate(2026, 7, 7),
    dayOfMonth: 7,
    endDate: undefined,
  });

  // Four subscriptions, including one annual one to exercise non-monthly
  // frequency handling in the commitments engine.
  await addCommitmentForUser(user.id, {
    name: "Netflix",
    direction: "OUTFLOW",
    category: "SUBSCRIPTION",
    amount: "649",
    isVariable: false,
    frequency: "MONTHLY",
    anchorDate: istDate(2026, 7, 12),
    dayOfMonth: 12,
    endDate: undefined,
  });
  await addCommitmentForUser(user.id, {
    name: "Spotify",
    direction: "OUTFLOW",
    category: "SUBSCRIPTION",
    amount: "119",
    isVariable: false,
    frequency: "MONTHLY",
    anchorDate: istDate(2026, 7, 15),
    dayOfMonth: 15,
    endDate: undefined,
  });
  await addCommitmentForUser(user.id, {
    name: "iCloud+",
    direction: "OUTFLOW",
    category: "SUBSCRIPTION",
    amount: "75",
    isVariable: false,
    frequency: "MONTHLY",
    anchorDate: istDate(2026, 7, 18),
    dayOfMonth: 18,
    endDate: undefined,
  });
  await addCommitmentForUser(user.id, {
    name: "Amazon Prime",
    direction: "OUTFLOW",
    category: "SUBSCRIPTION",
    amount: "1499",
    isVariable: false,
    frequency: "ANNUAL",
    anchorDate: istDate(2026, 2, 15),
    dayOfMonth: 15,
    endDate: undefined,
  });

  // Retirement / long-horizon holdings.
  await addAssetForUser(user.id, {
    name: "EPF",
    type: "EPF",
    investedAmount: "450000",
    currentValue: "620000",
    valuationAsOf: today,
    expectedAnnualReturnPercent: "8.25",
    isJoint: false,
    notes: undefined,
  });
  await addAssetForUser(user.id, {
    name: "PPF",
    type: "PPF",
    investedAmount: "300000",
    currentValue: "380000",
    valuationAsOf: today,
    expectedAnnualReturnPercent: "7.1",
    isJoint: false,
    notes: undefined,
  });

  // Everyday spending baseline.
  await setVariableSpendBaselineForUser(user.id, { monthlyAmount: "28000" });

  // One goal.
  await createGoal({
    user: { connect: { id: user.id } },
    name: "Child's Education Fund",
    targetAmount: "2500000",
    currentAmount: "200000",
    targetDate: istDate(2036, 6, 1),
    monthlyContribution: "12000",
    expectedAnnualReturnPercent: "10",
    inflationPercent: "6",
  });

  console.log("Seed complete.");
  console.log(`Sign in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
