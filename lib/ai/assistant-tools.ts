import type Anthropic from "@anthropic-ai/sdk";
import { todayIst } from "@/lib/dates";
import { formatMoney } from "@/lib/format-money";
import { formatLongDate } from "@/lib/format-date";
import { describeNetWorthAttribution } from "@/lib/format-attribution";
import { getTodayOverviewForUser } from "@/lib/services/headroom-service";
import { getWorthOverviewForUser } from "@/lib/services/worth-service";
import { getAheadOverviewForUser } from "@/lib/services/ahead-service";
import { getGoalsOverviewForUser } from "@/lib/services/goal-service";
import { requireOwnedLiabilityForScenario } from "@/lib/services/scenario-service";
import { NotFoundError } from "@/lib/services/account-service";
import { findUserById } from "@/lib/repositories/user-repository";
import { findAccountsByUserId } from "@/lib/repositories/account-repository";
import { findCommitmentsByUserId } from "@/lib/repositories/commitment-repository";
import { findGoalsByUserId } from "@/lib/repositories/goal-repository";
import { findVariableSpendBaselineByUserId } from "@/lib/repositories/variable-spend-baseline-repository";
import { LIABILITY_TYPE_LABELS } from "@/lib/validation/liability";
import { ASSET_TYPE_LABELS } from "@/lib/validation/asset";
import {
  checkAffordability,
  deriveRemainingScheduleParams,
  incomeChangeImpact,
  jobLossRunway,
  prepayVsInvest,
} from "@/lib/engines/decisions";
import type { ProjectionHorizonDays } from "@/lib/engines/ahead";

type ToolResult = { output: unknown; isError: boolean };

function ok(output: unknown): ToolResult {
  return { output, isError: false };
}

function err(message: string): ToolResult {
  return { output: { error: message }, isError: true };
}

function percent(value: { toFixed: (n: number) => string }): string {
  return `${value.toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Tool definitions — the JSON schemas Claude sees. No schema ever accepts a
// userId; every executor below takes it only from the authenticated session.
// ---------------------------------------------------------------------------

export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_today_snapshot",
    description: "What's safe to spend right now, before the next payday, and anything that needs attention.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_net_worth_overview",
    description:
      "The full balance sheet: net worth, assets, liabilities (including each liability's id, needed to call simulate_prepay_vs_invest), allocation, and recent growth.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_ahead_overview",
    description: "The forward cash-flow projection and recurring-payment summary over a given horizon.",
    input_schema: {
      type: "object",
      properties: {
        horizonDays: {
          type: "integer",
          enum: [30, 60, 90],
          description: "Projection window in days. Defaults to 90 if omitted.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_goals_overview",
    description: "Every savings goal and whether it's on track to be met by its target date.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "simulate_job_loss_runway",
    description:
      "How long savings would last, and whether the emergency fund target is met, if salary stopped today.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "simulate_income_change",
    description: "Models the effect of a new monthly salary (a raise or a pay cut) on the cash-flow projection.",
    input_schema: {
      type: "object",
      properties: {
        newMonthlySalary: {
          type: "string",
          description: 'New gross monthly salary in INR, as a plain decimal string, e.g. "95000".',
        },
      },
      required: ["newMonthlySalary"],
      additionalProperties: false,
    },
  },
  {
    name: "check_affordability",
    description: "Whether a planned purchase can be made without damaging the emergency fund or delaying goals.",
    input_schema: {
      type: "object",
      properties: {
        purchaseAmount: { type: "string", description: "Purchase price in INR, plain decimal string." },
        purchaseDate: { type: "string", description: "Planned purchase date, YYYY-MM-DD." },
      },
      required: ["purchaseAmount", "purchaseDate"],
      additionalProperties: false,
    },
  },
  {
    name: "simulate_prepay_vs_invest",
    description:
      "For one specific loan, compares prepaying a lump sum against investing it instead. The liabilityId comes from get_net_worth_overview's liabilities list.",
    input_schema: {
      type: "object",
      properties: {
        liabilityId: {
          type: "string",
          description: "The liability id, as returned by get_net_worth_overview's liabilities list.",
        },
        lumpSum: { type: "string", description: "Lump sum available, plain decimal string." },
        prepaymentMode: { type: "string", enum: ["REDUCE_TENURE", "REDUCE_EMI"] },
      },
      required: ["liabilityId", "lumpSum", "prepaymentMode"],
      additionalProperties: false,
    },
  },
];

// ---------------------------------------------------------------------------
// Executors — one per tool, each scoped to `userId` from the session only.
// ---------------------------------------------------------------------------

async function getTodaySnapshot(userId: string): Promise<ToolResult> {
  const overview = await getTodayOverviewForUser(userId, todayIst());
  return ok({
    headroomAmount: formatMoney(overview.headroom.amount),
    window: {
      from: formatLongDate(overview.headroom.window.from),
      to: formatLongDate(overview.headroom.window.to),
      basis: overview.headroom.window.basis,
    },
    netWorth: formatMoney(overview.netWorth.netWorth),
    upcomingCommitments: overview.upcomingCommitments.map((c) => ({
      label: c.label,
      amount: formatMoney(c.amount),
      date: formatLongDate(c.date),
    })),
    attentionItems: overview.attentionItems.map((a) => a.message),
  });
}

async function getNetWorthOverview(userId: string): Promise<ToolResult> {
  const overview = await getWorthOverviewForUser(userId);
  return ok({
    netWorth: formatMoney(overview.netWorth.netWorth),
    totalAssets: formatMoney(overview.netWorth.totalAssets),
    totalLiabilities: formatMoney(overview.netWorth.totalLiabilities),
    ownershipSplit: {
      individual: formatMoney(overview.ownershipSplit.individual.netWorth),
      joint: formatMoney(overview.ownershipSplit.joint.netWorth),
    },
    assetAllocation: overview.assetAllocation.map((a) => ({
      type: ASSET_TYPE_LABELS[a.type],
      value: formatMoney(a.value),
      percentOfTotal: percent(a.percentOfTotal),
    })),
    liabilities: overview.liabilities.map((l) => ({
      id: l.id,
      name: l.name,
      type: LIABILITY_TYPE_LABELS[l.type],
      outstandingPrincipal: formatMoney(l.outstandingPrincipal),
      annualInterestRatePercent: percent(l.annualInterestRatePercent),
    })),
    cagr: overview.cagr ? percent(overview.cagr.cagrPercent) : null,
    attributionThisMonth: overview.attribution ? describeNetWorthAttribution(overview.attribution) : null,
  });
}

const VALID_HORIZON_DAYS: ProjectionHorizonDays[] = [30, 60, 90];

async function getAheadOverview(userId: string, input: unknown): Promise<ToolResult> {
  const requested = (input as { horizonDays?: unknown } | null)?.horizonDays;
  const horizonDays: ProjectionHorizonDays = VALID_HORIZON_DAYS.includes(requested as ProjectionHorizonDays)
    ? (requested as ProjectionHorizonDays)
    : 90;

  const overview = await getAheadOverviewForUser(userId, todayIst(), horizonDays);
  return ok({
    horizonDays,
    projectedEndBalance: formatMoney(overview.projection.endBalance),
    goesNegative: overview.projection.goesNegative,
    firstNegativeDate: overview.projection.firstNegativeDate
      ? formatLongDate(overview.projection.firstNegativeDate)
      : null,
    recurringSummary: {
      monthlyOutflowTotal: formatMoney(overview.recurringSummary.monthlyOutflowTotal),
      annualOutflowTotal: formatMoney(overview.recurringSummary.annualOutflowTotal),
    },
    dormantCommitmentCount: overview.dormantCommitments.length,
  });
}

async function getGoalsOverview(userId: string): Promise<ToolResult> {
  const goals = await getGoalsOverviewForUser(userId, todayIst());
  return ok({
    goals: goals.map((g) => ({
      name: g.name,
      targetDate: formatLongDate(g.targetDate),
      status: g.projection.status,
      progressPercent: percent(g.projection.progressPercent),
      requiredMonthlyContribution: formatMoney(g.projection.requiredMonthlyContribution),
      shortfallAtTargetDate: formatMoney(g.projection.shortfallAtTargetDate),
    })),
  });
}

async function simulateJobLossRunway(userId: string): Promise<ToolResult> {
  const user = await findUserById(userId);
  if (!user) {
    return err("User not found.");
  }
  const [accounts, commitments, variableSpend] = await Promise.all([
    findAccountsByUserId(userId),
    findCommitmentsByUserId(userId, { activeOnly: true }),
    findVariableSpendBaselineByUserId(userId),
  ]);

  const result = jobLossRunway({
    now: todayIst(),
    accounts: accounts.map((a) => ({ currentBalance: a.currentBalance })),
    commitments,
    variableSpendBaseline: variableSpend ? { monthlyAmount: variableSpend.monthlyAmount } : null,
    emergencyFundTargetMonths: user.emergencyFundTargetMonths,
  });

  return ok({
    startingBalance: formatMoney(result.startingBalance),
    monthlyBurn: formatMoney(result.monthlyBurn),
    runwayDays: result.runwayDays,
    depletionDate: result.depletionDate ? formatLongDate(result.depletionDate) : null,
    emergencyFundCoverageMonths: result.emergencyFundCoverageMonths.toFixed(1),
    meetsEmergencyFundTarget: result.meetsEmergencyFundTarget,
    assumptions: result.assumptions,
  });
}

async function simulateIncomeChange(userId: string, input: unknown): Promise<ToolResult> {
  const newMonthlySalary = (input as { newMonthlySalary?: unknown } | null)?.newMonthlySalary;
  if (typeof newMonthlySalary !== "string" || newMonthlySalary.trim() === "") {
    return err("newMonthlySalary is required and must be a decimal string.");
  }

  const [accounts, commitments] = await Promise.all([
    findAccountsByUserId(userId),
    findCommitmentsByUserId(userId, { activeOnly: true }),
  ]);

  try {
    const result = incomeChangeImpact({
      now: todayIst(),
      accounts: accounts.map((a) => ({ currentBalance: a.currentBalance })),
      commitments,
      newMonthlySalary,
    });
    return ok({
      currentMonthlySalary: formatMoney(result.currentMonthlySalary),
      newMonthlySalary: formatMoney(result.newMonthlySalary),
      monthlySalaryDelta: formatMoney(result.monthlySalaryDelta),
      projectedEndBalanceDelta: formatMoney(result.projectedEndBalanceDelta),
      assumptions: result.assumptions,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Couldn't simulate that income change.");
  }
}

async function checkAffordabilityTool(userId: string, input: unknown): Promise<ToolResult> {
  const args = input as { purchaseAmount?: unknown; purchaseDate?: unknown } | null;
  if (typeof args?.purchaseAmount !== "string" || typeof args?.purchaseDate !== "string") {
    return err("purchaseAmount and purchaseDate are both required.");
  }
  const purchaseDate = new Date(args.purchaseDate);
  if (Number.isNaN(purchaseDate.getTime())) {
    return err("purchaseDate must be a valid date (YYYY-MM-DD).");
  }

  const user = await findUserById(userId);
  if (!user) {
    return err("User not found.");
  }
  const [accounts, commitments, goals] = await Promise.all([
    findAccountsByUserId(userId),
    findCommitmentsByUserId(userId, { activeOnly: true }),
    findGoalsByUserId(userId),
  ]);

  const result = checkAffordability({
    now: todayIst(),
    purchaseAmount: args.purchaseAmount,
    purchaseDate,
    accounts: accounts.map((a) => ({ currentBalance: a.currentBalance })),
    commitments,
    emergencyFundTargetMonths: user.emergencyFundTargetMonths,
    goals: goals.map((g) => ({
      id: g.id,
      name: g.name,
      currentAmount: g.currentAmount,
      targetAmount: g.targetAmount,
      monthlyContribution: g.monthlyContribution,
      expectedAnnualReturnPercent: g.expectedAnnualReturnPercent,
    })),
  });

  return ok({
    resultingHeadroom: formatMoney(result.resultingHeadroom),
    commitmentsAtRisk: result.commitmentsAtRisk.map((c) => ({
      name: c.name,
      date: formatLongDate(c.date),
      amount: formatMoney(c.amount),
    })),
    emergencyFundMonthsBefore: result.emergencyFundMonthsBefore.toFixed(1),
    emergencyFundMonthsAfter: result.emergencyFundMonthsAfter.toFixed(1),
    goalImpacts: result.goalImpacts.map((g) => ({
      goalName: g.goalName,
      monthsDelayed: g.monthsDelayed,
    })),
    assumptions: result.assumptions,
  });
}

const VALID_PREPAYMENT_MODES = ["REDUCE_TENURE", "REDUCE_EMI"] as const;

async function simulatePrepayVsInvest(userId: string, input: unknown): Promise<ToolResult> {
  const args = input as { liabilityId?: unknown; lumpSum?: unknown; prepaymentMode?: unknown } | null;
  if (typeof args?.liabilityId !== "string" || args.liabilityId.trim() === "") {
    return err("liabilityId is required.");
  }
  if (typeof args?.lumpSum !== "string" || args.lumpSum.trim() === "") {
    return err("lumpSum is required.");
  }
  if (!VALID_PREPAYMENT_MODES.includes(args.prepaymentMode as (typeof VALID_PREPAYMENT_MODES)[number])) {
    return err('prepaymentMode must be "REDUCE_TENURE" or "REDUCE_EMI".');
  }

  try {
    const [liability, user] = await Promise.all([
      requireOwnedLiabilityForScenario(userId, args.liabilityId),
      findUserById(userId),
    ]);
    if (!user) {
      return err("User not found.");
    }

    const { remainingTenureMonths, firstDueDate } = deriveRemainingScheduleParams(liability, todayIst());
    const result = prepayVsInvest({
      liability: {
        outstandingPrincipal: liability.outstandingPrincipal,
        annualRatePercent: liability.annualInterestRatePercent,
        remainingTenureMonths,
        firstDueDate,
        prepaymentPenaltyPercent: liability.prepaymentPenaltyPercent ?? undefined,
        isSelfOccupied: liability.isSelfOccupied,
      },
      lumpSum: args.lumpSum,
      prepaymentMode: args.prepaymentMode as (typeof VALID_PREPAYMENT_MODES)[number],
      taxProfile: { regime: user.taxRegime, taxSlabPercent: user.taxSlabPercent },
    });

    return ok({
      prepay: {
        interestSaved: formatMoney(result.prepay.interestSaved),
        monthsSaved: result.prepay.monthsSaved,
        netBenefit: formatMoney(result.prepay.netBenefit),
        newPayoffDate: formatLongDate(result.prepay.newPayoffDate),
      },
      investScenarios: result.investScenarios.map((s) => ({
        label: s.label,
        annualReturnPercent: percent(s.annualReturnPercent),
        postTaxValue: formatMoney(s.postTaxValue),
      })),
      hurdleRatePercent: percent(result.hurdleRatePercent),
    });
  } catch (e) {
    if (e instanceof NotFoundError) {
      return err("That loan wasn't found — ask get_net_worth_overview for the current list of liabilities and their ids.");
    }
    return err(e instanceof Error ? e.message : "Couldn't run that simulation.");
  }
}

export async function executeAssistantTool(userId: string, name: string, input: unknown): Promise<ToolResult> {
  switch (name) {
    case "get_today_snapshot":
      return getTodaySnapshot(userId);
    case "get_net_worth_overview":
      return getNetWorthOverview(userId);
    case "get_ahead_overview":
      return getAheadOverview(userId, input);
    case "get_goals_overview":
      return getGoalsOverview(userId);
    case "simulate_job_loss_runway":
      return simulateJobLossRunway(userId);
    case "simulate_income_change":
      return simulateIncomeChange(userId, input);
    case "check_affordability":
      return checkAffordabilityTool(userId, input);
    case "simulate_prepay_vs_invest":
      return simulatePrepayVsInvest(userId, input);
    default:
      return err(`Unknown tool: ${name}`);
  }
}
