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
import { upsertNetWorthSnapshot } from "@/lib/repositories/networth-snapshot-repository";
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
  const savingsAccount = await addAccountForUser(user.id, {
    name: "HDFC Savings",
    type: "SAVINGS",
    currentBalance: "85000",
    isJoint: false,
    balanceAsOf: today,
  });
  const currentAccount = await addAccountForUser(user.id, {
    name: "ICICI Current",
    type: "CURRENT",
    currentBalance: "35000",
    isJoint: false,
    balanceAsOf: today,
  });

  // Home loan — ₹38.4L outstanding at 8.6%. EMI hand-verified against
  // lib/engines/amortisation.test.ts for a ₹40L / 8.6% / 240m loan.
  const homeLoan = await addLiabilityForUser(user.id, {
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
  const epf = await addAssetForUser(user.id, {
    name: "EPF",
    type: "EPF",
    investedAmount: "450000",
    currentValue: "620000",
    valuationAsOf: today,
    expectedAnnualReturnPercent: "8.25",
    isJoint: false,
    notes: undefined,
  });
  const ppf = await addAssetForUser(user.id, {
    name: "PPF",
    type: "PPF",
    investedAmount: "300000",
    currentValue: "380000",
    valuationAsOf: today,
    expectedAnnualReturnPercent: "7.1",
    isJoint: false,
    notes: undefined,
  });

  // Backfilled net worth history — the only way V0 has any history at all
  // is a snapshot captured on every mutation, so a brand-new seed would
  // otherwise show a single flat point and the Worth screen's history
  // chart, month-over-month attribution, year-over-year comparison and
  // CAGR would all have nothing to work with. Six hand-picked points over
  // the past 15 months tell a plausible story — savings and retirement
  // assets growing, the home loan amortising down — without needing to be
  // amortisation-exact; today's real snapshot (already captured by the
  // asset/liability/account calls above) is left untouched.
  const historicalPoints: {
    monthsAgo: number;
    accountsTotal: string;
    epfValue: string;
    ppfValue: string;
    loanOutstanding: string;
  }[] = [
    { monthsAgo: 15, accountsTotal: "70000", epfValue: "480000", ppfValue: "280000", loanOutstanding: "3950000" },
    { monthsAgo: 12, accountsTotal: "78000", epfValue: "510000", ppfValue: "300000", loanOutstanding: "3920000" },
    { monthsAgo: 9, accountsTotal: "90000", epfValue: "540000", ppfValue: "320000", loanOutstanding: "3895000" },
    { monthsAgo: 6, accountsTotal: "95000", epfValue: "565000", ppfValue: "340000", loanOutstanding: "3875000" },
    { monthsAgo: 3, accountsTotal: "105000", epfValue: "590000", ppfValue: "360000", loanOutstanding: "3855000" },
    { monthsAgo: 1, accountsTotal: "115000", epfValue: "605000", ppfValue: "370000", loanOutstanding: "3847000" },
  ];

  for (const point of historicalPoints) {
    const capturedAt = new Date(today);
    capturedAt.setMonth(capturedAt.getMonth() - point.monthsAgo);

    const netWorth = (
      Number(point.accountsTotal) +
      Number(point.epfValue) +
      Number(point.ppfValue) -
      Number(point.loanOutstanding)
    ).toFixed(4);
    const totalAssets = (Number(point.accountsTotal) + Number(point.epfValue) + Number(point.ppfValue)).toFixed(4);

    // Splits the accounts total roughly in the same proportion as today's
    // two accounts — plausible, not exact; nothing downstream depends on
    // the split itself, only the total.
    const savingsShare = (Number(point.accountsTotal) * 0.7).toFixed(4);
    const currentShare = (Number(point.accountsTotal) * 0.3).toFixed(4);

    await upsertNetWorthSnapshot(user.id, capturedAt, {
      netWorth,
      totalAssets,
      totalLiabilities: Number(point.loanOutstanding).toFixed(4),
      accountsJson: [
        { id: savingsAccount.id, currentBalance: savingsShare },
        { id: currentAccount.id, currentBalance: currentShare },
      ],
      assetsJson: [
        { id: epf.id, currentValue: Number(point.epfValue).toFixed(4), investedAmount: Number(point.epfValue).toFixed(4) },
        { id: ppf.id, currentValue: Number(point.ppfValue).toFixed(4), investedAmount: Number(point.ppfValue).toFixed(4) },
      ],
      liabilitiesJson: [{ id: homeLoan.id, outstandingPrincipal: Number(point.loanOutstanding).toFixed(4) }],
    });
  }

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
