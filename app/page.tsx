import Link from "next/link";
import { auth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-sm font-medium tracking-tight">Headroom</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            render={<Link href={session?.user ? "/today" : "/sign-in"} />}
            nativeButton={false}
            variant="ghost"
            size="sm"
          >
            {session?.user ? "Go to app" : "Sign in"}
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Know what you can actually afford.
        </h1>
        <p className="text-muted-foreground mt-3 max-w-md text-base">
          Not what you spent — what you can safely do next.
        </p>
        {!session?.user ? (
          <Button render={<Link href="/sign-up" />} nativeButton={false} className="mt-6">
            Create an account
          </Button>
        ) : null}
      </main>
    </div>
  );
}
