import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createUser, deleteUser } from "@/lib/repositories/user-repository";
import { createAssistantMessage, findAssistantMessagesByUserId } from "@/lib/repositories/assistant-message-repository";
import { getClient } from "@/lib/ai/anthropic-client";
import { askAssistant, generateWeeklySummary, RateLimitError } from "@/lib/services/assistant-service";

vi.mock("@/lib/ai/anthropic-client", () => ({
  ASSISTANT_MODEL: "claude-sonnet-5",
  getClient: vi.fn(),
  isAssistantConfigured: vi.fn(() => true),
}));

describe("assistant-service", () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await Promise.all(createdUserIds.map((id) => deleteUser(id).catch(() => undefined)));
    await prisma.$disconnect();
  });

  afterEach(() => {
    vi.mocked(getClient).mockReset();
  });

  async function makeUser() {
    const user = await createUser({
      email: `assistant-service-test-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: "unused-in-this-test",
      name: "Assistant Service Test",
      taxSlabPercent: "30",
    });
    createdUserIds.push(user.id);
    return user;
  }

  it("rejects once the daily cap is hit, before ever calling the model, and writes no new row", async () => {
    const user = await makeUser();
    for (let i = 0; i < 40; i++) {
      await createAssistantMessage(user.id, "USER", `message ${i}`);
    }

    await expect(askAssistant(user.id, "one more question")).rejects.toBeInstanceOf(RateLimitError);
    expect(vi.mocked(getClient)).not.toHaveBeenCalled();

    const messages = await findAssistantMessagesByUserId(user.id);
    expect(messages).toHaveLength(40);
  });

  it("drives the tool-use loop: calls a tool, then returns the model's final text, persisting both turns", async () => {
    const user = await makeUser();

    const create = vi
      .fn()
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "toolu_1", name: "get_today_snapshot", input: {} }],
      })
      .mockResolvedValueOnce({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Your headroom is fine." }],
      });
    vi.mocked(getClient).mockReturnValue({ messages: { create } } as never);

    const reply = await askAssistant(user.id, "What's my headroom?");

    expect(reply).toBe("Your headroom is fine.");
    expect(create).toHaveBeenCalledTimes(2);

    const messages = await findAssistantMessagesByUserId(user.id);
    expect(messages.map((m) => [m.role, m.content])).toEqual([
      ["USER", "What's my headroom?"],
      ["ASSISTANT", "Your headroom is fine."],
    ]);
  });

  it("stops after MAX_TOOL_ROUNDS and returns a fallback message rather than looping forever", async () => {
    const user = await makeUser();

    const create = vi.fn().mockResolvedValue({
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "toolu_x", name: "get_today_snapshot", input: {} }],
    });
    vi.mocked(getClient).mockReturnValue({ messages: { create } } as never);

    const reply = await askAssistant(user.id, "keep calling tools forever");

    expect(create).toHaveBeenCalledTimes(5);
    expect(reply.length).toBeGreaterThan(0);
  });
});

describe("generateWeeklySummary", () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await Promise.all(createdUserIds.map((id) => deleteUser(id).catch(() => undefined)));
    await prisma.$disconnect();
  });

  afterEach(() => {
    vi.mocked(getClient).mockReset();
  });

  async function makeUser() {
    const user = await createUser({
      email: `weekly-summary-test-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: "unused-in-this-test",
      name: "Weekly Summary Test",
      taxSlabPercent: "30",
    });
    createdUserIds.push(user.id);
    return user;
  }

  it("runs even when the user has already hit today's askAssistant cap — it isn't the same budget", async () => {
    const user = await makeUser();
    for (let i = 0; i < 40; i++) {
      await createAssistantMessage(user.id, "USER", `message ${i}`);
    }

    const create = vi.fn().mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "You're on track. Nothing needs attention this week." }],
    });
    vi.mocked(getClient).mockReturnValue({ messages: { create } } as never);

    const summary = await generateWeeklySummary(user.id);

    expect(summary).toBe("You're on track. Nothing needs attention this week.");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("persists a synthetic 'Weekly check-in' turn rather than continuing the user's real conversation", async () => {
    const user = await makeUser();
    await createAssistantMessage(user.id, "USER", "What's my headroom right now?");
    await createAssistantMessage(user.id, "ASSISTANT", "Your headroom is fine.");

    const create = vi.fn().mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Weekly summary text." }],
    });
    vi.mocked(getClient).mockReturnValue({ messages: { create } } as never);

    await generateWeeklySummary(user.id);

    const messages = await findAssistantMessagesByUserId(user.id);
    expect(messages.map((m) => [m.role, m.content])).toEqual([
      ["USER", "What's my headroom right now?"],
      ["ASSISTANT", "Your headroom is fine."],
      ["USER", "Weekly check-in"],
      ["ASSISTANT", "Weekly summary text."],
    ]);

    // The earlier real conversation is never replayed into the weekly
    // summary's own request — only the fixed prompt is sent.
    const requestArg = create.mock.calls[0][0] as { messages: { role: string; content: unknown }[] };
    expect(requestArg.messages).toHaveLength(1);
    expect(requestArg.messages[0].role).toBe("user");
  });
});
