import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAssistantConfigured } from "@/lib/ai/anthropic-client";
import { listConversationForUser } from "@/lib/services/assistant-service";
import { findUserById } from "@/lib/repositories/user-repository";
import { isPushConfigured } from "@/lib/push/send-push";
import { EmptyState } from "@/components/empty-state";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { Button } from "@/components/ui/button";
import { toggleWeeklyAskSummaryAction } from "./actions";

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

  const [user, history] = await Promise.all([findUserById(userId), listConversationForUser(userId)]);
  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ask</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Questions about your money, answered from your real numbers.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border p-4 text-sm">
        <div>
          <p className="font-medium">Weekly check-in</p>
          <p className="text-muted-foreground mt-0.5">
            A short summary of where you stand, emailed every Monday morning
            {isPushConfigured() ? " (and pushed, if you've turned on notifications)" : ""}.
          </p>
        </div>
        <form action={toggleWeeklyAskSummaryAction.bind(null, !user.weeklyAskSummaryEnabled)}>
          <Button type="submit" variant={user.weeklyAskSummaryEnabled ? "outline" : "default"} size="sm">
            {user.weeklyAskSummaryEnabled ? "Turn off" : "Turn on"}
          </Button>
        </form>
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
