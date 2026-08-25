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
 * Drives the bounded tool-use loop against Claude for one turn, given the
 * message list to send (already including the new turn's prompt). Shared
 * by both the interactive `askAssistant` and the scheduled
 * `generateWeeklySummary` — everything about grounding, tool dispatch and
 * round budgeting lives here exactly once.
 */
async function runToolLoop(userId: string, messages: Anthropic.MessageParam[]): Promise<string> {
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
  return finalText;
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

  const finalText = await runToolLoop(userId, messages);

  await createAssistantMessage(userId, "ASSISTANT", finalText);
  return finalText;
}

const WEEKLY_SUMMARY_PROMPT =
  "Give me a brief weekly check-in: my current headroom, anything flagged for attention, and whether my goals are on track. Keep it to a short paragraph, not a list of everything you can see.";

/**
 * Generates the scheduled weekly check-in via the same tool-use loop as an
 * interactive question, but as its own fresh turn rather than a
 * continuation of the user's real conversation — a periodic summary
 * shouldn't be shaped by whatever they last happened to ask about, and it
 * doesn't count against `askAssistant`'s daily cap, since that budget is
 * for the user's own usage. Persisted as a normal user/assistant pair so
 * it shows up naturally in their Ask history.
 */
export async function generateWeeklySummary(userId: string): Promise<string> {
  await createAssistantMessage(userId, "USER", "Weekly check-in");
  const finalText = await runToolLoop(userId, [{ role: "user", content: WEEKLY_SUMMARY_PROMPT }]);
  await createAssistantMessage(userId, "ASSISTANT", finalText);
  return finalText;
}

export const listConversationForUser = findAssistantMessagesByUserId;
export const clearConversationForUser = deleteAssistantMessagesByUserId;
