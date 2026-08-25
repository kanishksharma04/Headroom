import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getHouseholdPartnersForUser,
  listPendingInvitesReceivedByUser,
  listPendingInvitesSentByUser,
} from "@/lib/services/household-service";
import { getHouseholdOverviewForUser } from "@/lib/services/household-overview-service";
import { acceptHouseholdInviteAction, declineHouseholdInviteAction, revokeHouseholdInviteAction } from "./actions";
import { InviteForm } from "@/components/household/invite-form";
import { StatCard } from "@/components/stat-card";
import { Money } from "@/components/money";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function HouseholdPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const [overview, partners, receivedInvites, sentInvites] = await Promise.all([
    getHouseholdOverviewForUser(userId),
    getHouseholdPartnersForUser(userId),
    listPendingInvitesReceivedByUser(userId),
    listPendingInvitesSentByUser(userId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Household</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          A shared, read-only view of everyone you&apos;re linked with — nothing here can be edited, only
          seen.
        </p>
      </div>

      {receivedInvites.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Invites for you</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {receivedInvites.map((invite) => (
                <li key={invite.id} className="flex items-center justify-between py-2.5">
                  <p className="text-sm">
                    <span className="font-medium">{invite.from.name}</span> wants to share a household
                    view with you
                  </p>
                  <div className="flex items-center gap-2">
                    <form action={acceptHouseholdInviteAction.bind(null, invite.id)}>
                      <Button type="submit" size="sm">
                        Accept
                      </Button>
                    </form>
                    <form action={declineHouseholdInviteAction.bind(null, invite.id)}>
                      <Button type="submit" variant="outline" size="sm">
                        Decline
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {overview ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Combined net worth" value={<Money value={overview.combinedNetWorth} shorthand colorize />} />
            <StatCard label="Combined assets" value={<Money value={overview.combinedTotalAssets} shorthand />} />
            <StatCard
              label="Combined liabilities"
              value={<Money value={overview.combinedTotalLiabilities} shorthand />}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>By person</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {overview.members.map((member) => (
                  <li key={member.userId} className="flex items-center justify-between py-2.5">
                    <p className="text-sm font-medium">
                      {member.name}
                      {member.userId === userId ? <span className="text-muted-foreground font-normal"> · You</span> : null}
                    </p>
                    <div className="text-muted-foreground flex items-center gap-4 text-sm">
                      <span>
                        Assets <Money value={member.totalAssets} className="text-foreground font-medium" />
                      </span>
                      <span>
                        Liabilities <Money value={member.totalLiabilities} className="text-foreground font-medium" />
                      </span>
                      <Money value={member.netWorth} className="font-medium" colorize />
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="No one linked yet"
          description="Invite a partner by email below to see your combined household picture — nothing changes about your own data until they accept."
        />
      )}

      {partners.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Linked</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {partners.map((partner) => (
                <li key={partner.linkId} className="flex items-center justify-between py-2.5">
                  <p className="text-sm font-medium">{partner.user.name}</p>
                  <form action={revokeHouseholdInviteAction.bind(null, partner.linkId)}>
                    <Button type="submit" variant="outline" size="sm">
                      Unlink
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Invite a partner</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <InviteForm />
          {sentInvites.length > 0 ? (
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Waiting on
              </p>
              <ul className="divide-y">
                {sentInvites.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between py-2.5 text-sm">
                    <p>{invite.to.name}</p>
                    <form action={revokeHouseholdInviteAction.bind(null, invite.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Cancel
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
