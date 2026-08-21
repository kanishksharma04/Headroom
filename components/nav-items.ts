import { CalendarRange, List, Scale, Sun, Target, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/ahead", label: "Ahead", icon: CalendarRange },
  { href: "/worth", label: "Worth", icon: Wallet },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/decide", label: "Decide", icon: Scale },
  { href: "/records", label: "Records", icon: List },
];
