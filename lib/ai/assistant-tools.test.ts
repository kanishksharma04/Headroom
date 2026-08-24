import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createUser, deleteUser } from "@/lib/repositories/user-repository";
import { createAccount } from "@/lib/repositories/account-repository";
import { createCommitment } from "@/lib/repositories/commitment-repository";
import { createLiability } from "@/lib/repositories/liability-repository";
import { createGoal } from "@/lib/repositories/goal-repository";
import { istDate } from "@/lib/dates";
import { executeAssistantTool } from "@/lib/ai/assistant-tools";

describe("assistant-tools", () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await Promise.all(createdUserIds.map((id) => deleteUser(id).catch(() => undefined)));
    await prisma.$disconnect();
  });

  async function makeFixtureUser() {
    const user = await createUser({
      email: `assistant-tools-test-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: "unused-in-this-test",
      name: "Assistant Tools Test",
      taxSlabPercent: "30",
    });
    createdUserIds.push(user.id);

    await createAccount({
      user: { connect: { id: user.id } },
      name: "HDFC Savings",
      type: "SAVINGS",
      currentBalance: "120000",
      balanceAsOf: new Date(),
    });
    await createCommitment({
      user: { connect: { id: user.id } },
      name: "Salary",
      direction: "INFLOW",
      category: "SALARY",
      amount: "85000",
      frequency: "MONTHLY",
      anchorDate: istDate(2026, 0, 1),
      dayOfMonth: 1,
      isActive: true,
      isVariable: false,
    });
    const liability = await createLiability({
      user: { connect: { id: user.id } },
      name: "Home Loan",
      type: "HOME_LOAN",
      principalAmount: "4000000",
      annualInterestRatePercent: "8.6",
      startDate: istDate(2023, 6, 5),
      tenureMonths: 240,
      emiAmount: "34966.51",
      emiDayOfMonth: 5,
      outstandingPrincipal: "3840000",
      outstandingAsOf: new Date(),
      isTaxDeductible: true,
      isSelfOccupied: true,
    });
    await createGoal({
      user: { connect: { id: user.id } },
      name: "Education Fund",
      targetAmount: "2500000",
      currentAmount: "200000",
      targetDate: istDate(2036, 5, 1),
      monthlyContribution: "12000",
      expectedAnnualReturnPercent: "10",
      inflationPercent: "6",
    });

    return { user, liability };
  }

  it("get_today_snapshot returns a formatted headroom figure and window", async () => {
    const { user } = await makeFixtureUser();
    const { output, isError } = await executeAssistantTool(user.id, "get_today_snapshot", {});
    expect(isError).toBe(false);
    expect(output).toMatchObject({ headroomAmount: expect.stringContaining("₹") });
  });

  it("get_net_worth_overview surfaces the liability's id, name, and formatted rate", async () => {
    const { user, liability } = await makeFixtureUser();
    const { output, isError } = await executeAssistantTool(user.id, "get_net_worth_overview", {});
    expect(isError).toBe(false);
    expect(output).toMatchObject({
      netWorth: expect.stringContaining("₹"),
      liabilities: [
        expect.objectContaining({
          id: liability.id,
          name: "Home Loan",
          annualInterestRatePercent: "8.60%",
        }),
      ],
    });
  });

  it("get_ahead_overview defaults to a 90-day horizon and formats the recurring summary", async () => {
    const { user } = await makeFixtureUser();
    const { output, isError } = await executeAssistantTool(user.id, "get_ahead_overview", {});
    expect(isError).toBe(false);
    expect(output).toMatchObject({ horizonDays: 90, projectedEndBalance: expect.stringContaining("₹") });
  });

  it("get_goals_overview lists the fixture goal with a formatted date and percent", async () => {
    const { user } = await makeFixtureUser();
    const { output, isError } = await executeAssistantTool(user.id, "get_goals_overview", {});
    expect(isError).toBe(false);
    expect(output).toMatchObject({
      goals: [expect.objectContaining({ name: "Education Fund", targetDate: "1 June 2036" })],
    });
  });

  it("simulate_job_loss_runway floors emergency-fund coverage and formats the burn rate", async () => {
    const { user } = await makeFixtureUser();
    const { output, isError } = await executeAssistantTool(user.id, "simulate_job_loss_runway", {});
    expect(isError).toBe(false);
    expect(output).toMatchObject({ monthlyBurn: expect.stringContaining("₹") });
  });

  it("simulate_income_change rejects a missing newMonthlySalary as a tool error, not a throw", async () => {
    const { user } = await makeFixtureUser();
    const { isError, output } = await executeAssistantTool(user.id, "simulate_income_change", {});
    expect(isError).toBe(true);
    expect(output).toMatchObject({ error: expect.any(String) });
  });

  it("simulate_income_change succeeds with a valid salary figure", async () => {
    const { user } = await makeFixtureUser();
    const { output, isError } = await executeAssistantTool(user.id, "simulate_income_change", {
      newMonthlySalary: "95000",
    });
    expect(isError).toBe(false);
    expect(output).toMatchObject({
      currentMonthlySalary: expect.stringContaining("₹"),
      newMonthlySalary: expect.stringContaining("₹"),
    });
  });

  it("check_affordability formats a resulting headroom and emergency-fund coverage", async () => {
    const { user } = await makeFixtureUser();
    const { output, isError } = await executeAssistantTool(user.id, "check_affordability", {
      purchaseAmount: "50000",
      purchaseDate: "2026-09-01",
    });
    expect(isError).toBe(false);
    expect(output).toMatchObject({ resultingHeadroom: expect.stringContaining("₹") });
  });

  it("check_affordability rejects a malformed purchaseDate as a tool error", async () => {
    const { user } = await makeFixtureUser();
    const { isError } = await executeAssistantTool(user.id, "check_affordability", {
      purchaseAmount: "50000",
      purchaseDate: "not-a-date",
    });
    expect(isError).toBe(true);
  });

  it("simulate_prepay_vs_invest resolves the liability by id and returns formatted results", async () => {
    const { user, liability } = await makeFixtureUser();
    const { output, isError } = await executeAssistantTool(user.id, "simulate_prepay_vs_invest", {
      liabilityId: liability.id,
      lumpSum: "500000",
      prepaymentMode: "REDUCE_TENURE",
    });
    expect(isError).toBe(false);
    expect(output).toMatchObject({
      prepay: expect.objectContaining({ interestSaved: expect.stringContaining("₹") }),
    });
  });

  it("simulate_prepay_vs_invest refuses a liability id belonging to another user", async () => {
    const { user: userA } = await makeFixtureUser();
    const { liability: liabilityB } = await makeFixtureUser();

    const { isError, output } = await executeAssistantTool(userA.id, "simulate_prepay_vs_invest", {
      liabilityId: liabilityB.id,
      lumpSum: "100000",
      prepaymentMode: "REDUCE_TENURE",
    });
    expect(isError).toBe(true);
    expect(output).toMatchObject({ error: expect.any(String) });
  });
});
