import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listAccountsForUser } from "@/lib/services/account-service";
import { toIstDateInputValue, todayIst } from "@/lib/dates";
import { Logo } from "@/components/logo";
import { OnboardingForm } from "@/app/onboarding/onboarding-form";

export default async function OnboardingPage() {
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
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Let&apos;s find your headroom</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Four things, and we&apos;ll show you exactly what you can safely spend before your next
          payday. You can add everything else — assets, other loans, goals — afterwards.
        </p>
      </div>
      <OnboardingForm todayIso={toIstDateInputValue(todayIst())} />
      <p className="text-muted-foreground text-center text-sm">
        Have a bank statement handy?{" "}
        <Link href="/onboarding/import" className="text-foreground font-medium underline-offset-4 hover:underline">
          Import it as a CSV
        </Link>{" "}
        to prefill your account and recurring payments.
      </p>
    </div>
  );
}
