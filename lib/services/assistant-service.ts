import { addDays } from "date-fns";
import type Anthropic from "@anthropic-ai/sdk";
import { ASSISTANT_MODEL, getClient } from "@/lib/ai/anthropic-client";
import { SYSTEM_PROMPT } from "@/lib/ai/assistant-prompt";
import { ASSISTANT_TOOLS, executeAssistantTool } from "@/lib/ai/assistant-tools";
import { todayIst } from "@/lib/dates";
import {
  countUserMessagesSince,
  createAssistantMessage,
  deleteAssistantMessagesByUserId,
  findAssistantMessagesByUserId,
  findRecentAssistantMessagesByUserId,
} from "@/lib/repositories/assistant-message-repository";

export class RateLimitError extends Error {}

const DAILY_MESSAGE_CAP = 40;
const MAX_TOOL_ROUNDS = 5;
const MAX_TOKENS_PER_CALL = 2048;
/** How much of the conversation is replayed to Claude each turn — bounded
 * so a long-lived conversation's context (and cost) doesn't grow
 * unboundedly. The /assistant page itself still shows full history. */
const HISTORY_REPLAY_LIMIT = 20;

async function assertUnderDailyCap(userId: string): Promise<void> {
  const dayStart = todayIst();
  const dayEnd = addDays(dayStart, 1);
  const count = await countUserMessagesSince(userId, dayStart, dayEnd);
  if (count >= DAILY_MESSAGE_CAP) {
    throw new RateLimitError(
      `You've hit today's limit of ${DAILY_MESSAGE_CAP} questions to Ask. It resets at midnight IST.`,
    );
  }
}

/**
 * Answers one turn of the user's single ongoing Ask conversation: persists
 * the user's message, replays recent history plus a bounded tool-use loop
 * against Claude, persists and returns the final reply. Every tool call is
 * scoped to `userId` — nothing in a tool's arguments can name a different
 * user's data.
 */
export async function askAssistant(userId: string, userMessage: string): Promise<string> {
  await assertUnderDailyCap(userId);
  await createAssistantMessage(userId, "USER", userMessage);

  const recent = await findRecentAssistantMessagesByUserId(userId, HISTORY_REPLAY_LIMIT);
  const messages: Anthropic.MessageParam[] = recent.map((m) => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
  }));

  const client = getClient();
  if (!client) {
    throw new Error("Ask is not configured.");
  }

  let finalText = "";
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: MAX_TOKENS_PER_CALL,
      system: SYSTEM_PROMPT,
      tools: ASSISTANT_TOOLS,
      messages,
    });

    const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
    finalText = textBlocks.map((b) => b.text).join("\n");

    if (response.stop_reason !== "tool_use") {
      break;
    }

    // Response content blocks (TextBlock/ToolUseBlock/...) are a superset of
    // what MessageParam's request-side ContentBlockParam union needs, and
    // Anthropic's own multi-turn tool-use pattern is to replay them back
    // verbatim — hence the cast rather than hand-mapping every block kind.
    messages.push({ role: "assistant", content: response.content as unknown as Anthropic.ContentBlockParam[] });

    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const { output, isError } = await executeAssistantTool(userId, block.name, block.input);
        return {
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: JSON.stringify(output),
          is_error: isError,
        };
      }),
    );
    messages.push({ role: "user", content: results });
  }

  if (!finalText) {
    finalText = "I wasn't able to finish that within the tool budget for this turn — try asking again, more specifically.";
  }

  await createAssistantMessage(userId, "ASSISTANT", finalText);
  return finalText;
}

export const listConversationForUser = findAssistantMessagesByUserId;
export const clearConversationForUser = deleteAssistantMessagesByUserId;
