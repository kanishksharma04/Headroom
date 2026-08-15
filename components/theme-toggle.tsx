"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const emptySubscribe = () => () => {};

function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const mounted = useMounted();
  const { resolvedTheme, setTheme } = useTheme();

  if (!mounted) {
    return <Button variant="ghost" size="icon" aria-label="Toggle theme" disabled />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
