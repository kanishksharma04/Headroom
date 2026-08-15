import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createUser, deleteUser } from "@/lib/repositories/user-repository";
import { createAccount, findAccountById } from "@/lib/repositories/account-repository";

describe("account repository", () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await Promise.all(createdUserIds.map((id) => deleteUser(id).catch(() => undefined)));
    await prisma.$disconnect();
  });

  it("round-trips a decimal balance without precision loss", async () => {
    const user = await createUser({
      email: `repo-test-${Date.now()}@example.com`,
      passwordHash: "unused-in-this-test",
      name: "Repository Test",
      taxSlabPercent: "30",
    });
    createdUserIds.push(user.id);

    const preciseBalance = "123456789012.3456";

    const account = await createAccount({
      user: { connect: { id: user.id } },
      name: "Test Savings",
      type: "SAVINGS",
      currentBalance: preciseBalance,
      balanceAsOf: new Date("2026-08-15T00:00:00.000Z"),
    });

    const fetched = await findAccountById(account.id);

    expect(fetched).not.toBeNull();
    expect(fetched!.currentBalance.toString()).toBe(preciseBalance);
  });
});
