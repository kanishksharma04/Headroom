import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createUser, deleteUser } from "@/lib/repositories/user-repository";
import {
  countUserMessagesSince,
  createAssistantMessage,
  deleteAssistantMessagesByUserId,
  findAssistantMessagesByUserId,
  findRecentAssistantMessagesByUserId,
} from "@/lib/repositories/assistant-message-repository";

describe("assistant-message repository", () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await Promise.all(createdUserIds.map((id) => deleteUser(id).catch(() => undefined)));
    await prisma.$disconnect();
  });

  async function makeUser() {
    const user = await createUser({
      email: `assistant-repo-test-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: "unused-in-this-test",
      name: "Assistant Repo Test",
      taxSlabPercent: "30",
    });
    createdUserIds.push(user.id);
    return user;
  }

  it("countUserMessagesSince respects the [since, before) window and ignores ASSISTANT-role rows", async () => {
    const user = await makeUser();
    const dayStart = new Date("2026-08-10T00:00:00.000Z");
    const dayEnd = new Date("2026-08-11T00:00:00.000Z");

    await prisma.assistantMessage.create({
      data: { userId: user.id, role: "USER", content: "before window", createdAt: new Date("2026-08-09T23:59:00.000Z") },
    });
    await prisma.assistantMessage.create({
      data: { userId: user.id, role: "USER", content: "in window", createdAt: new Date("2026-08-10T12:00:00.000Z") },
    });
    await prisma.assistantMessage.create({
      data: { userId: user.id, role: "ASSISTANT", content: "reply, not counted", createdAt: new Date("2026-08-10T12:01:00.000Z") },
    });
    await prisma.assistantMessage.create({
      data: { userId: user.id, role: "USER", content: "at window end, excluded", createdAt: dayEnd },
    });

    const count = await countUserMessagesSince(user.id, dayStart, dayEnd);
    expect(count).toBe(1);
  });

  it("findRecentAssistantMessagesByUserId returns the tail in chronological order", async () => {
    const user = await makeUser();
    for (let i = 0; i < 5; i++) {
      await createAssistantMessage(user.id, i % 2 === 0 ? "USER" : "ASSISTANT", `message ${i}`);
    }

    const recent = await findRecentAssistantMessagesByUserId(user.id, 3);
    expect(recent.map((m) => m.content)).toEqual(["message 2", "message 3", "message 4"]);
  });

  it("deleteAssistantMessagesByUserId only clears the given user's rows", async () => {
    const userA = await makeUser();
    const userB = await makeUser();
    await createAssistantMessage(userA.id, "USER", "a's message");
    await createAssistantMessage(userB.id, "USER", "b's message");

    await deleteAssistantMessagesByUserId(userA.id);

    expect(await findAssistantMessagesByUserId(userA.id)).toHaveLength(0);
    expect(await findAssistantMessagesByUserId(userB.id)).toHaveLength(1);
  });
});
