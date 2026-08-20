import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTodayOverviewForUser } from "@/lib/services/headroom-service";
import { AppShell } from "@/components/app-shell";
import { SignOutButton } from "@/components/sign-out-button";
import type { AttentionMessage } from "@/components/attention-banner";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  const { attentionItems } = await getTodayOverviewForUser(session.user.id, new Date());
  const attentionMessages: AttentionMessage[] = attentionItems.map((item, index) => ({
    key: item.sourceId ?? `${item.kind}-${index}`,
    message: item.message,
  }));

  return (
    <AppShell signOutSlot={<SignOutButton />} attentionItems={attentionMessages}>
      {children}
    </AppShell>
  );
}
