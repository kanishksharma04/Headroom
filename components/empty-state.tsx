import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center px-6 py-16 text-center",
        className,
      )}
    >
      <h2 className="text-lg font-medium tracking-tight">{title}</h2>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
