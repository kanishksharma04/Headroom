import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listAccountsForUser } from "@/lib/services/account-service";
import { toIstDateInputValue, todayIst } from "@/lib/dates";
import { Logo } from "@/components/logo";
import { StatementImportForm } from "@/components/onboarding/statement-import-form";

export default async function OnboardingImportPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  const accounts = await listAccountsForUser(userId);
  if (accounts.length > 0) {
    redirect("/today");
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-6 py-16">
      <div className="text-center">
        <Logo className="justify-center" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Import from a bank statement</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          A CSV export of your account gives us a current balance and any payments that repeat —
          rent, EMIs, subscriptions. You&apos;ll review everything before it&apos;s saved; the file
          itself is never stored.
        </p>
      </div>
      <StatementImportForm todayIso={toIstDateInputValue(todayIst())} />
    </div>
  );
}
