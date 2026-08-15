import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export type StatCardProps = {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  className?: string;
};

export function StatCard({ label, value, delta, className }: StatCardProps) {
  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent>
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        {delta ? (
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">{delta}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
