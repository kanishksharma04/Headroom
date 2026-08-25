import { prisma } from "@/lib/prisma";
import type { HouseholdInvite, HouseholdInviteStatus, Prisma, User } from "@/lib/generated/prisma/client";

export function createHouseholdInvite(data: Prisma.HouseholdInviteCreateInput): Promise<HouseholdInvite> {
  return prisma.householdInvite.create({ data });
}

export function findHouseholdInviteById(id: string): Promise<HouseholdInvite | null> {
  return prisma.householdInvite.findUnique({ where: { id } });
}

/** Any invite between the two users, in either direction, that isn't a settled decline/revoke — used to block a duplicate invite. */
export function findPendingOrAcceptedInviteBetween(
  userIdA: string,
  userIdB: string,
): Promise<HouseholdInvite | null> {
  return prisma.householdInvite.findFirst({
    where: {
      status: { in: ["PENDING", "ACCEPTED"] },
      OR: [
        { inviterUserId: userIdA, inviteeUserId: userIdB },
        { inviterUserId: userIdB, inviteeUserId: userIdA },
      ],
    },
  });
}

export function findInvitesReceivedByUserId(
  userId: string,
  status: HouseholdInviteStatus,
): Promise<(HouseholdInvite & { inviter: User })[]> {
  return prisma.householdInvite.findMany({
    where: { inviteeUserId: userId, status },
    include: { inviter: true },
    orderBy: { createdAt: "desc" },
  });
}

export function findInvitesSentByUserId(
  userId: string,
  status: HouseholdInviteStatus,
): Promise<(HouseholdInvite & { invitee: User })[]> {
  return prisma.householdInvite.findMany({
    where: { inviterUserId: userId, status },
    include: { invitee: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Every ACCEPTED link this user is a party to, in either direction — the sole source of "who's in my household." */
export function findAcceptedLinksForUser(
  userId: string,
): Promise<(HouseholdInvite & { inviter: User; invitee: User })[]> {
  return prisma.householdInvite.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ inviterUserId: userId }, { inviteeUserId: userId }],
    },
    include: { inviter: true, invitee: true },
  });
}

export function updateHouseholdInviteStatus(
  id: string,
  status: HouseholdInviteStatus,
  respondedAt: Date,
): Promise<HouseholdInvite> {
  return prisma.householdInvite.update({ where: { id }, data: { status, respondedAt } });
}

export function deleteHouseholdInvite(id: string): Promise<HouseholdInvite> {
  return prisma.householdInvite.delete({ where: { id } });
}
