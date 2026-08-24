"use client";

import { useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type AssistantChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const EXAMPLE_QUESTIONS = [
  "What's my job-loss runway?",
  "Can I afford a ₹15L car this year?",
  "Am I on track for my goals?",
];

export function AssistantChat({ initialMessages }: { initialMessages: AssistantChatMessage[] }) {
  const [messages, setMessages] = useState<AssistantChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isPending) {
      return;
    }

    const userMessage: AssistantChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setIsPending(true);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !data.reply) {
        setError(data.error ?? "Something went wrong answering that. Try again.");
        return;
      }
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data.reply! }]);
    } catch {
      setError("Couldn't reach the assistant. Check your connection and try again.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleClear() {
    setError(null);
    await fetch("/api/assistant/chat", { method: "DELETE" });
    setMessages([]);
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-1 flex-col gap-4">
        {messages.length === 0 ? (
          <EmptyState
            title="Ask about your money"
            description={`Try “${EXAMPLE_QUESTIONS[0]}” or “${EXAMPLE_QUESTIONS[1]}”`}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                  m.role === "user" ? "bg-primary text-primary-foreground self-end" : "bg-muted self-start",
                )}
              >
                {m.content}
              </div>
            ))}
            {isPending ? (
              <div className="bg-muted text-muted-foreground max-w-[85%] self-start rounded-2xl px-4 py-2.5 text-sm">
                Thinking…
              </div>
            ) : null}
          </div>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="Ask about your money…"
          rows={1}
          disabled={isPending}
          aria-label="Ask a question"
        />
        <Button type="submit" disabled={isPending || !input.trim()} size="icon" aria-label="Send">
          <Send />
        </Button>
        {messages.length > 0 ? (
          <Button type="button" variant="destructive" size="icon" onClick={handleClear} aria-label="Clear conversation">
            <Trash2 />
          </Button>
        ) : null}
      </form>
    </div>
  );
}
