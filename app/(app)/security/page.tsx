import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { findUserById } from "@/lib/repositories/user-repository";
import { getPushPublicKey, isPushConfigured } from "@/lib/push/send-push";
import { TotpEnrollment } from "@/components/security/totp-enrollment";
import { TotpDisableForm } from "@/components/security/totp-disable-form";
import { PushNotificationToggle } from "@/components/security/push-notification-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SecurityPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await findUserById(userId);
  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          This holds your full balance sheet — a second step at sign-in is worth the extra few seconds.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Two-factor authentication</CardTitle>
          <Badge variant={user.totpEnabled ? "secondary" : "outline"}>
            {user.totpEnabled ? "On" : "Off"}
          </Badge>
        </CardHeader>
        <CardContent>{user.totpEnabled ? <TotpDisableForm /> : <TotpEnrollment />}</CardContent>
      </Card>

      {isPushConfigured() ? (
        <Card>
          <CardHeader>
            <CardTitle>Push notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <PushNotificationToggle publicKey={getPushPublicKey()!} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
