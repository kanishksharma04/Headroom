import { auth } from "@/lib/auth";
import { isAssistantConfigured } from "@/lib/ai/anthropic-client";
import { askAssistant, clearConversationForUser, RateLimitError } from "@/lib/services/assistant-service";
import { askAssistantRequestSchema } from "@/lib/validation/assistant";

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function POST(request: Request): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!isAssistantConfigured()) {
    return Response.json({ error: "Ask is not configured yet." }, { status: 503 });
  }

  const parsed = askAssistantRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Enter a question." }, { status: 400 });
  }

  try {
    const reply = await askAssistant(userId, parsed.data.message);
    return Response.json({ reply });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return Response.json({ error: e.message }, { status: 429 });
    }
    console.error("Ask assistant failed:", e);
    return Response.json({ error: "Something went wrong answering that. Try again." }, { status: 500 });
  }
}

export async function DELETE(): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }
  await clearConversationForUser(userId);
  return new Response(null, { status: 204 });
}
