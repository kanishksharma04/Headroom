import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createUser, deleteUser } from "@/lib/repositories/user-repository";
import { NotFoundError } from "@/lib/services/account-service";
import {
  acceptHouseholdInvite,
  declineHouseholdInvite,
  DuplicateInviteError,
  getHouseholdPartnersForUser,
  inviteToHousehold,
  listPendingInvitesReceivedByUser,
  listPendingInvitesSentByUser,
  revokeHouseholdInvite,
} from "@/lib/services/household-service";

describe("household-service", () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await Promise.all(createdUserIds.map((id) => deleteUser(id).catch(() => undefined)));
    await prisma.$disconnect();
  });

  async function makeUser(name = "Household Test") {
    const user = await createUser({
      email: `household-test-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: "unused-in-this-test",
      name,
      taxSlabPercent: "30",
    });
    createdUserIds.push(user.id);
    return user;
  }

  it("rejects an invite to an email with no Headroom account", async () => {
    const inviter = await makeUser();
    await expect(inviteToHousehold(inviter.id, "no-such-account@example.com")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("rejects inviting yourself", async () => {
    const user = await makeUser();
    await expect(inviteToHousehold(user.id, user.email)).rejects.toThrow("You can't invite yourself.");
  });

  it("rejects a second invite while one is already pending between the same pair", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    await inviteToHousehold(a.id, b.email);

    await expect(inviteToHousehold(a.id, b.email)).rejects.toBeInstanceOf(DuplicateInviteError);
    // and in the reverse direction too
    await expect(inviteToHousehold(b.id, a.email)).rejects.toBeInstanceOf(DuplicateInviteError);
  });

  it("rejects a new invite once the pair is already linked", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    const invite = await inviteToHousehold(a.id, b.email);
    await acceptHouseholdInvite(b.id, invite.id);

    await expect(inviteToHousehold(a.id, b.email)).rejects.toBeInstanceOf(DuplicateInviteError);
  });

  it("only the invitee can accept — the inviter cannot accept their own invite", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    const invite = await inviteToHousehold(a.id, b.email);

    await expect(acceptHouseholdInvite(a.id, invite.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("a stranger with no relationship to the invite cannot accept, decline, or revoke it", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    const stranger = await makeUser("Stranger");
    const invite = await inviteToHousehold(a.id, b.email);

    await expect(acceptHouseholdInvite(stranger.id, invite.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(declineHouseholdInvite(stranger.id, invite.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(revokeHouseholdInvite(stranger.id, invite.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects accepting or declining an invite that's already been responded to", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    const invite = await inviteToHousehold(a.id, b.email);
    await acceptHouseholdInvite(b.id, invite.id);

    await expect(acceptHouseholdInvite(b.id, invite.id)).rejects.toThrow("no longer pending");
    await expect(declineHouseholdInvite(b.id, invite.id)).rejects.toThrow("no longer pending");
  });

  it("declining leaves both users unlinked", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    const invite = await inviteToHousehold(a.id, b.email);
    await declineHouseholdInvite(b.id, invite.id);

    expect(await getHouseholdPartnersForUser(a.id)).toEqual([]);
    expect(await getHouseholdPartnersForUser(b.id)).toEqual([]);
  });

  it("either party can revoke an accepted link, and it stops appearing for both", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    const invite = await inviteToHousehold(a.id, b.email);
    await acceptHouseholdInvite(b.id, invite.id);
    expect(await getHouseholdPartnersForUser(a.id)).toHaveLength(1);

    // the invitee (not just the inviter) can revoke
    await revokeHouseholdInvite(b.id, invite.id);

    expect(await getHouseholdPartnersForUser(a.id)).toEqual([]);
    expect(await getHouseholdPartnersForUser(b.id)).toEqual([]);
  });

  it("resolves the partner correctly in both directions — as inviter and as invitee", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    const invite = await inviteToHousehold(a.id, b.email);
    await acceptHouseholdInvite(b.id, invite.id);

    const fromA = await getHouseholdPartnersForUser(a.id);
    const fromB = await getHouseholdPartnersForUser(b.id);

    expect(fromA.map((p) => p.user.id)).toEqual([b.id]);
    expect(fromB.map((p) => p.user.id)).toEqual([a.id]);
  });

  it("never includes an unrelated third user as a partner", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    const stranger = await makeUser("Stranger");
    const invite = await inviteToHousehold(a.id, b.email);
    await acceptHouseholdInvite(b.id, invite.id);

    const partnersOfA = await getHouseholdPartnersForUser(a.id);
    expect(partnersOfA.some((p) => p.user.id === stranger.id)).toBe(false);
    expect(await getHouseholdPartnersForUser(stranger.id)).toEqual([]);
  });

  it("a merely-pending invite grants no visibility yet", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    await inviteToHousehold(a.id, b.email);

    expect(await getHouseholdPartnersForUser(a.id)).toEqual([]);
    expect(await getHouseholdPartnersForUser(b.id)).toEqual([]);
  });

  it("lists a pending invite as received by the invitee and sent by the inviter, and nothing once it's settled", async () => {
    const a = await makeUser("A");
    const b = await makeUser("B");
    const invite = await inviteToHousehold(a.id, b.email);

    expect((await listPendingInvitesReceivedByUser(b.id)).map((i) => i.id)).toEqual([invite.id]);
    expect((await listPendingInvitesSentByUser(a.id)).map((i) => i.id)).toEqual([invite.id]);

    await acceptHouseholdInvite(b.id, invite.id);

    expect(await listPendingInvitesReceivedByUser(b.id)).toEqual([]);
    expect(await listPendingInvitesSentByUser(a.id)).toEqual([]);
  });
});
