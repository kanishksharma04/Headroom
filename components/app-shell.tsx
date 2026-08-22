"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/nav-items";
import { ThemeToggle } from "@/components/theme-toggle";
import { AttentionBanner, type AttentionMessage } from "@/components/attention-banner";
import { Button } from "@/components/ui/button";

function SecurityLink() {
  return (
    <Button
      render={<Link href="/security" />}
      nativeButton={false}
      variant="ghost"
      size="icon"
      aria-label="Security settings"
    >
      <Shield />
    </Button>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  signOutSlot,
  attentionItems,
}: {
  children: ReactNode;
  signOutSlot: ReactNode;
  attentionItems: AttentionMessage[];
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 flex-col">
      <div className="print:hidden">
        <AttentionBanner items={attentionItems} />
      </div>
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="hidden w-56 shrink-0 flex-col border-r px-3 py-6 md:flex print:hidden">
          <span className="mb-8 px-3 text-sm font-medium tracking-tight">Headroom</span>
          <nav className="flex flex-1 flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center justify-between px-1 pt-4">
            <SecurityLink />
            <ThemeToggle />
            {signOutSlot}
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b px-4 py-3 md:hidden print:hidden">
            <span className="text-sm font-medium tracking-tight">Headroom</span>
            <div className="flex items-center gap-1">
              <SecurityLink />
              <ThemeToggle />
              {signOutSlot}
            </div>
          </header>

          <main className="flex flex-1 flex-col pb-16 md:pb-0 print:pb-0">{children}</main>

          <nav className="bg-background fixed inset-x-0 bottom-0 flex border-t md:hidden print:hidden">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="size-5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
