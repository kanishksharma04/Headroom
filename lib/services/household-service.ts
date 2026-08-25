import {
  createHouseholdInvite,
  deleteHouseholdInvite,
  findAcceptedLinksForUser,
  findHouseholdInviteById,
  findInvitesReceivedByUserId,
  findInvitesSentByUserId,
  findPendingOrAcceptedInviteBetween,
  updateHouseholdInviteStatus,
} from "@/lib/repositories/household-invite-repository";
import { findUserByEmail } from "@/lib/repositories/user-repository";
import { NotFoundError } from "@/lib/services/account-service";
import type { HouseholdInvite, User } from "@/lib/generated/prisma/client";

export class DuplicateInviteError extends Error {}

/**
 * Sends a household invite by email — the invitee must already have a
 * Headroom account. This is a deliberate simplification: it avoids a
 * whole second flow (invite-by-email-token, unauthenticated accept
 * routes, expiry) for someone who doesn't have an account yet, in
 * exchange for a small ask — sign up first, then accept.
 */
export async function inviteToHousehold(inviterUserId: string, inviteeEmail: string): Promise<HouseholdInvite> {
  const invitee = await findUserByEmail(inviteeEmail);
  if (!invitee) {
    throw new NotFoundError("A Headroom account with that email");
  }
  if (invitee.id === inviterUserId) {
    throw new Error("You can't invite yourself.");
  }

  const existing = await findPendingOrAcceptedInviteBetween(inviterUserId, invitee.id);
  if (existing) {
    throw new DuplicateInviteError(
      existing.status === "ACCEPTED"
        ? "You're already linked with this person."
        : "There's already a pending invite between you.",
    );
  }

  return createHouseholdInvite({
    inviter: { connect: { id: inviterUserId } },
    invitee: { connect: { id: invitee.id } },
  });
}

async function requireInviteParty(userId: string, inviteId: string): Promise<HouseholdInvite> {
  const invite = await findHouseholdInviteById(inviteId);
  if (!invite || (invite.inviterUserId !== userId && invite.inviteeUserId !== userId)) {
    throw new NotFoundError("Household invite");
  }
  return invite;
}

/** Only the invitee can accept — accepting is the one action that actually grants read access, so it must be their own decision. */
export async function acceptHouseholdInvite(userId: string, inviteId: string): Promise<void> {
  const invite = await requireInviteParty(userId, inviteId);
  if (invite.inviteeUserId !== userId) {
    throw new NotFoundError("Household invite");
  }
  if (invite.status !== "PENDING") {
    throw new Error("This invite is no longer pending.");
  }
  await updateHouseholdInviteStatus(inviteId, "ACCEPTED", new Date());
}

export async function declineHouseholdInvite(userId: string, inviteId: string): Promise<void> {
  const invite = await requireInviteParty(userId, inviteId);
  if (invite.inviteeUserId !== userId) {
    throw new NotFoundError("Household invite");
  }
  if (invite.status !== "PENDING") {
    throw new Error("This invite is no longer pending.");
  }
  await updateHouseholdInviteStatus(inviteId, "DECLINED", new Date());
}

/** Either party can end a link — cancelling a pending invite they sent, or unlinking an accepted one. */
export async function revokeHouseholdInvite(userId: string, inviteId: string): Promise<void> {
  const invite = await requireInviteParty(userId, inviteId);
  if (invite.status !== "PENDING" && invite.status !== "ACCEPTED") {
    throw new Error("This invite is already settled.");
  }
  await deleteHouseholdInvite(inviteId);
}

export type HouseholdInviteReceived = { id: string; from: User; createdAt: Date };
export type HouseholdInviteSent = { id: string; to: User; createdAt: Date };

export async function listPendingInvitesReceivedByUser(userId: string): Promise<HouseholdInviteReceived[]> {
  const invites = await findInvitesReceivedByUserId(userId, "PENDING");
  return invites.map((invite) => ({ id: invite.id, from: invite.inviter, createdAt: invite.createdAt }));
}

export async function listPendingInvitesSentByUser(userId: string): Promise<HouseholdInviteSent[]> {
  const invites = await findInvitesSentByUserId(userId, "PENDING");
  return invites.map((invite) => ({ id: invite.id, to: invite.invitee, createdAt: invite.createdAt }));
}

export type HouseholdPartner = { linkId: string; user: User };

/**
 * The complete, and only, list of people this user has actually granted —
 * and been granted — mutual visibility with. Every household read (the
 * combined overview, and nothing else) is built by calling this first and
 * only ever reading data for `userId` itself plus whatever this returns —
 * so a correct answer here is what keeps the feature leak-free.
 */
export async function getHouseholdPartnersForUser(userId: string): Promise<HouseholdPartner[]> {
  const links = await findAcceptedLinksForUser(userId);
  return links.map((link) => ({
    linkId: link.id,
    user: link.inviterUserId === userId ? link.invitee : link.inviter,
  }));
}
