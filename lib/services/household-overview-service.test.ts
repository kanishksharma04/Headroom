import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createUser, deleteUser } from "@/lib/repositories/user-repository";
import { createAccount } from "@/lib/repositories/account-repository";
import { acceptHouseholdInvite, inviteToHousehold, revokeHouseholdInvite } from "@/lib/services/household-service";
import { getHouseholdOverviewForUser } from "@/lib/services/household-overview-service";

describe("household-overview-service", () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await Promise.all(createdUserIds.map((id) => deleteUser(id).catch(() => undefined)));
    await prisma.$disconnect();
  });

  async function makeUser(name: string) {
    const user = await createUser({
      email: `household-overview-test-${name}-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: "unused-in-this-test",
      name,
      taxSlabPercent: "30",
    });
    createdUserIds.push(user.id);
    return user;
  }

  async function giveBalance(userId: string, amount: string) {
    await createAccount({
      user: { connect: { id: userId } },
      name: "Bank",
      type: "SAVINGS",
      currentBalance: amount,
      balanceAsOf: new Date(),
    });
  }

  it("returns null for a user with no accepted partners", async () => {
    const solo = await makeUser("Solo");
    expect(await getHouseholdOverviewForUser(solo.id)).toBeNull();
  });

  it("combines net worth across exactly the linked pair, correctly summed", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    await giveBalance(a.id, "100000");
    await giveBalance(b.id, "50000");
    const invite = await inviteToHousehold(a.id, b.email);
    await acceptHouseholdInvite(b.id, invite.id);

    const overview = await getHouseholdOverviewForUser(a.id);

    expect(overview).not.toBeNull();
    expect(overview!.combinedNetWorth.toString()).toBe("150000");
    expect(overview!.members).toHaveLength(2);
    expect(overview!.members.map((m) => m.userId).sort()).toEqual([a.id, b.id].sort());
  });

  it("is symmetric — both linked users see the same combined household", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    await giveBalance(a.id, "100000");
    await giveBalance(b.id, "50000");
    const invite = await inviteToHousehold(a.id, b.email);
    await acceptHouseholdInvite(b.id, invite.id);

    const fromA = await getHouseholdOverviewForUser(a.id);
    const fromB = await getHouseholdOverviewForUser(b.id);

    expect(fromA!.combinedNetWorth.toString()).toBe(fromB!.combinedNetWorth.toString());
  });

  it("never leaks an unrelated third user's data into a two-person household", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    const stranger = await makeUser("Stranger");
    await giveBalance(a.id, "100000");
    await giveBalance(b.id, "50000");
    // The stranger has real, sizeable net worth of their own — if this
    // ever leaked in, the combined total and member count would both be
    // visibly wrong, not just silently off by a rounding error.
    await giveBalance(stranger.id, "999999999");
    const invite = await inviteToHousehold(a.id, b.email);
    await acceptHouseholdInvite(b.id, invite.id);

    const overview = await getHouseholdOverviewForUser(a.id);

    expect(overview!.members).toHaveLength(2);
    expect(overview!.members.some((m) => m.userId === stranger.id)).toBe(false);
    expect(overview!.combinedNetWorth.toString()).toBe("150000");
  });

  it("a pending (not yet accepted) invite grants no visibility into the other person's numbers", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    await giveBalance(b.id, "999999999");
    await inviteToHousehold(a.id, b.email);

    expect(await getHouseholdOverviewForUser(a.id)).toBeNull();
  });

  it("revoking a link immediately cuts off visibility for both sides", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    await giveBalance(a.id, "100000");
    await giveBalance(b.id, "50000");
    const invite = await inviteToHousehold(a.id, b.email);
    await acceptHouseholdInvite(b.id, invite.id);
    expect(await getHouseholdOverviewForUser(a.id)).not.toBeNull();

    await revokeHouseholdInvite(a.id, invite.id);

    expect(await getHouseholdOverviewForUser(a.id)).toBeNull();
    expect(await getHouseholdOverviewForUser(b.id)).toBeNull();
  });
});
