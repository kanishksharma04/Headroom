import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAssistantConfigured } from "@/lib/ai/anthropic-client";
import { listConversationForUser } from "@/lib/services/assistant-service";
import { EmptyState } from "@/components/empty-state";
import { AssistantChat } from "@/components/assistant/assistant-chat";

export default async function AssistantPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/sign-in");
  }

  if (!isAssistantConfigured()) {
    return (
      <EmptyState
        title="Ask isn't set up yet"
        description="This deployment doesn't have an ANTHROPIC_API_KEY configured, so Ask can't answer questions yet."
      />
    );
  }

  const history = await listConversationForUser(userId);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ask</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Questions about your money, answered from your real numbers.
        </p>
      </div>
      <AssistantChat
        initialMessages={history.map((m) => ({
          id: m.id,
          role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        }))}
      />
    </div>
  );
}
