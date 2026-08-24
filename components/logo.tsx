import { cn } from "@/lib/utils";

/** The gradient "H" mark, no wordmark — for tight spaces like a mobile header. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6", className)} aria-hidden="true">
      <defs>
        <linearGradient id="logo-mark-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#386BFF" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="#0B1220" />
      <rect x="7" y="6" width="6" height="17.5" rx="1.5" fill="url(#logo-mark-grad)" />
      <rect x="19" y="6" width="6" height="17.5" rx="1.5" fill="url(#logo-mark-grad)" />
      <rect x="13" y="12.5" width="6" height="4" rx="1" fill="url(#logo-mark-grad)" />
    </svg>
  );
}

/** The full lockup — mark plus "headroom" wordmark — for the sidebar header. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-sm font-semibold tracking-tight">headroom</span>
    </span>
  );
}
