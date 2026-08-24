import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createUser, deleteUser } from "@/lib/repositories/user-repository";
import { createAccount } from "@/lib/repositories/account-repository";
import {
  captureNetWorthSnapshotForUser,
  getNetWorthAttributionForUser,
  getNetWorthCagrForUser,
  getNetWorthHistoryForUser,
  getYearOverYearAttributionForUser,
} from "@/lib/services/networth-snapshot-service";
import { getIstParts, istDate } from "@/lib/dates";

describe("networth-snapshot-service", () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await Promise.all(createdUserIds.map((id) => deleteUser(id).catch(() => undefined)));
    await prisma.$disconnect();
  });

  async function makeUser() {
    const user = await createUser({
      email: `snapshot-test-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: "unused",
      name: "Snapshot Test",
      taxSlabPercent: "30",
    });
    createdUserIds.push(user.id);
    return user;
  }

  it("captures a snapshot reflecting the current balance sheet", async () => {
    const user = await makeUser();
    await createAccount({
      user: { connect: { id: user.id } },
      name: "Bank",
      type: "SAVINGS",
      currentBalance: "150000",
      balanceAsOf: new Date(),
    });

    await captureNetWorthSnapshotForUser(user.id, istDate(2026, 0, 1));
    const history = await getNetWorthHistoryForUser(user.id);

    expect(history).toHaveLength(1);
    expect(history[0].netWorth.toFixed(2)).toBe("150000.00");
  });

  it("upserts rather than duplicating when captured twice on the same IST day", async () => {
    const user = await makeUser();
    await createAccount({
      user: { connect: { id: user.id } },
      name: "Bank",
      type: "SAVINGS",
      currentBalance: "100000",
      balanceAsOf: new Date(),
    });

    const day = istDate(2026, 0, 5);
    await captureNetWorthSnapshotForUser(user.id, day);
    await createAccount({
      user: { connect: { id: user.id } },
      name: "Second account",
      type: "CASH",
      currentBalance: "20000",
      balanceAsOf: new Date(),
    });
    await captureNetWorthSnapshotForUser(user.id, day);

    const history = await getNetWorthHistoryForUser(user.id);
    expect(history).toHaveLength(1);
    expect(history[0].netWorth.toFixed(2)).toBe("120000.00");
  });

  it("returns null attribution when there is only one snapshot", async () => {
    const user = await makeUser();
    await createAccount({
      user: { connect: { id: user.id } },
      name: "Bank",
      type: "SAVINGS",
      currentBalance: "50000",
      balanceAsOf: new Date(),
    });
    await captureNetWorthSnapshotForUser(user.id, istDate(2026, 0, 1));

    const attribution = await getNetWorthAttributionForUser(user.id);
    expect(attribution).toBeNull();
  });

  it("decomposes a month-over-month change once two snapshots exist", async () => {
    const user = await makeUser();
    const account = await createAccount({
      user: { connect: { id: user.id } },
      name: "Bank",
      type: "SAVINGS",
      currentBalance: "100000",
      balanceAsOf: new Date(),
    });

    await captureNetWorthSnapshotForUser(user.id, istDate(2026, 0, 1));

    await prisma.account.update({
      where: { id: account.id },
      data: { currentBalance: "145000" },
    });
    await captureNetWorthSnapshotForUser(user.id, istDate(2026, 1, 5));

    const attribution = await getNetWorthAttributionForUser(user.id);
    expect(attribution).not.toBeNull();
    expect(attribution!.totalChange.toFixed(2)).toBe("45000.00");
    expect(attribution!.other.toFixed(2)).toBe("45000.00"); // a raw account delta, unattributable further
  });

  it("returns null year-over-year with less than a year of history", async () => {
    const user = await makeUser();
    const account = await createAccount({
      user: { connect: { id: user.id } },
      name: "Bank",
      type: "SAVINGS",
      currentBalance: "100000",
      balanceAsOf: new Date(),
    });
    await captureNetWorthSnapshotForUser(user.id, istDate(2026, 0, 1));
    await prisma.account.update({ where: { id: account.id }, data: { currentBalance: "145000" } });
    await captureNetWorthSnapshotForUser(user.id, istDate(2026, 5, 1)); // 5 months later

    expect(await getYearOverYearAttributionForUser(user.id)).toBeNull();
  });

  it("decomposes a year-over-year change once a year of history exists", async () => {
    const user = await makeUser();
    const account = await createAccount({
      user: { connect: { id: user.id } },
      name: "Bank",
      type: "SAVINGS",
      currentBalance: "100000",
      balanceAsOf: new Date(),
    });
    await captureNetWorthSnapshotForUser(user.id, istDate(2025, 0, 1));
    await prisma.account.update({ where: { id: account.id }, data: { currentBalance: "220000" } });
    await captureNetWorthSnapshotForUser(user.id, istDate(2026, 0, 5)); // just over a year later

    const yoy = await getYearOverYearAttributionForUser(user.id);
    expect(yoy).not.toBeNull();
    expect(yoy!.totalChange.toFixed(2)).toBe("120000.00");
    expect(getIstParts(yoy!.fromDate)).toMatchObject({ year: 2025, month: 0, day: 1 });
  });

  it("returns null CAGR under the minimum span, even with two snapshots", async () => {
    const user = await makeUser();
    const account = await createAccount({
      user: { connect: { id: user.id } },
      name: "Bank",
      type: "SAVINGS",
      currentBalance: "100000",
      balanceAsOf: new Date(),
    });
    await captureNetWorthSnapshotForUser(user.id, istDate(2026, 0, 1));
    await prisma.account.update({ where: { id: account.id }, data: { currentBalance: "110000" } });
    await captureNetWorthSnapshotForUser(user.id, istDate(2026, 1, 1)); // ~1 month later

    expect(await getNetWorthCagrForUser(user.id)).toBeNull();
  });

  it("computes CAGR from the earliest to the latest snapshot once there's enough span", async () => {
    const user = await makeUser();
    const account = await createAccount({
      user: { connect: { id: user.id } },
      name: "Bank",
      type: "SAVINGS",
      currentBalance: "100000",
      balanceAsOf: new Date(),
    });
    await captureNetWorthSnapshotForUser(user.id, istDate(2025, 0, 1));
    await prisma.account.update({ where: { id: account.id }, data: { currentBalance: "121000" } });
    // Exactly two years later, so this matches calculateCagr's own unit test: 10%/year.
    await captureNetWorthSnapshotForUser(user.id, istDate(2027, 0, 1));

    const cagr = await getNetWorthCagrForUser(user.id);
    expect(cagr).not.toBeNull();
    expect(cagr!.cagrPercent.toFixed(2)).toBe("10.00");
  });

  it("returns null CAGR when the earliest snapshot's net worth wasn't positive", async () => {
    const user = await makeUser();
    const account = await createAccount({
      user: { connect: { id: user.id } },
      name: "Bank",
      type: "SAVINGS",
      currentBalance: "0",
      balanceAsOf: new Date(),
    });
    await captureNetWorthSnapshotForUser(user.id, istDate(2025, 0, 1));
    await prisma.account.update({ where: { id: account.id }, data: { currentBalance: "100000" } });
    await captureNetWorthSnapshotForUser(user.id, istDate(2026, 5, 1));

    expect(await getNetWorthCagrForUser(user.id)).toBeNull();
  });
});
