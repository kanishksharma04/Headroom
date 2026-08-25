import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listAccountsForUser } from "@/lib/services/account-service";
import { toIstDateInputValue, todayIst } from "@/lib/dates";
import { EmptyState } from "@/components/empty-state";
import { StatementResyncForm } from "@/components/worth/statement-resync-form";

export default async function WorthSyncPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const accounts = await listAccountsForUser(userId);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sync a statement</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Refresh an account&apos;s balance and pick up any recurring payment it doesn&apos;t already
          have tracked — the same way onboarding read your first statement.
        </p>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          title="Add an account first"
          description="There's nothing to sync a statement against yet — add an account on Worth, then come back here."
        />
      ) : (
        <StatementResyncForm
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
          todayIso={toIstDateInputValue(todayIst())}
        />
      )}
    </div>
  );
}
