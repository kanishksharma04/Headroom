import { getHouseholdPartnersForUser } from "@/lib/services/household-service";
import { getWorthOverviewForUser } from "@/lib/services/worth-service";
import { findUserById } from "@/lib/repositories/user-repository";
import { sum, type Money } from "@/lib/money";

export type HouseholdMemberOverview = {
  userId: string;
  name: string;
  netWorth: Money;
  totalAssets: Money;
  totalLiabilities: Money;
};

export type HouseholdOverview = {
  members: HouseholdMemberOverview[];
  combinedNetWorth: Money;
  combinedTotalAssets: Money;
  combinedTotalLiabilities: Money;
};

/**
 * Combines this user's own numbers with every partner they have a mutual,
 * accepted household link with — `null` when they have no partners, so
 * the page can show an invite prompt instead of an empty combined view.
 * `getHouseholdPartnersForUser` is the single gate on whose data can
 * appear here; every member's figures are then produced by
 * `getWorthOverviewForUser`, exactly the same function each person's own
 * Worth page already uses — nothing about how a single user's numbers are
 * computed changes for this to work.
 */
export async function getHouseholdOverviewForUser(userId: string): Promise<HouseholdOverview | null> {
  const partners = await getHouseholdPartnersForUser(userId);
  if (partners.length === 0) {
    return null;
  }

  const self = await findUserById(userId);
  if (!self) {
    return null;
  }

  const memberIdentities = [
    { id: self.id, name: self.name },
    ...partners.map((partner) => ({ id: partner.user.id, name: partner.user.name })),
  ];

  const members = await Promise.all(
    memberIdentities.map(async (identity): Promise<HouseholdMemberOverview> => {
      const worth = await getWorthOverviewForUser(identity.id);
      return {
        userId: identity.id,
        name: identity.name,
        netWorth: worth.netWorth.netWorth,
        totalAssets: worth.netWorth.totalAssets,
        totalLiabilities: worth.netWorth.totalLiabilities,
      };
    }),
  );

  return {
    members,
    combinedNetWorth: sum(members.map((m) => m.netWorth)),
    combinedTotalAssets: sum(members.map((m) => m.totalAssets)),
    combinedTotalLiabilities: sum(members.map((m) => m.totalLiabilities)),
  };
}
