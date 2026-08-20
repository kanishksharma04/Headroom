"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export type AttentionMessage = { key: string; message: string };

export function AttentionBanner({ items }: { items: AttentionMessage[] }) {
  const [dismissed, setDismissed] = useState(false);

  if (items.length === 0 || dismissed) {
    return null;
  }

  return (
    <div className="border-destructive/30 bg-destructive/5 flex items-start gap-2 border-b px-4 py-2.5">
      <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex-1 text-sm">
        {items.map((item) => (
          <p key={item.key}>{item.message}</p>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground shrink-0"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
