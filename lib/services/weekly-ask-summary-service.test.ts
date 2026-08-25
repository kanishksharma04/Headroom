import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createUser, deleteUser, findUserById } from "@/lib/repositories/user-repository";
import { upsertPushSubscription } from "@/lib/repositories/push-subscription-repository";
import {
  sendWeeklySummaryForAllOptedInUsers,
  sendWeeklySummaryForUser,
} from "@/lib/services/weekly-ask-summary-service";
import { generateWeeklySummary } from "@/lib/services/assistant-service";
import { isAssistantConfigured } from "@/lib/ai/anthropic-client";
import { sendPushNotification } from "@/lib/push/send-push";

vi.mock("@/lib/services/assistant-service", () => ({
  generateWeeklySummary: vi.fn(),
}));

vi.mock("@/lib/ai/anthropic-client", () => ({
  isAssistantConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/push/send-push", () => ({
  sendPushNotification: vi.fn().mockResolvedValue({ sent: false, expired: false }),
}));

describe("weekly-ask-summary-service", () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    await Promise.all(createdUserIds.map((id) => deleteUser(id).catch(() => undefined)));
    await prisma.$disconnect();
  });

  afterEach(() => {
    vi.mocked(generateWeeklySummary).mockReset();
    vi.mocked(isAssistantConfigured).mockReset().mockReturnValue(true);
    vi.mocked(sendPushNotification).mockReset().mockResolvedValue({ sent: false, expired: false });
  });

  async function makeUser(weeklyAskSummaryEnabled = true) {
    const user = await createUser({
      email: `weekly-ask-service-test-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: "unused-in-this-test",
      name: "Weekly Ask Service Test",
      taxSlabPercent: "30",
      weeklyAskSummaryEnabled,
    });
    createdUserIds.push(user.id);
    return user;
  }

  it("generates and reports a summary for one user", async () => {
    const user = await makeUser();
    vi.mocked(generateWeeklySummary).mockResolvedValue("You're on track this week.");

    const result = await sendWeeklySummaryForUser(user);

    expect(result).toEqual({ userId: user.id, sent: false, pushedDeviceCount: 0, failed: false });
    expect(generateWeeklySummary).toHaveBeenCalledWith(user.id);
  });

  it("reports failed rather than throwing when generation itself errors", async () => {
    const user = await makeUser();
    vi.mocked(generateWeeklySummary).mockRejectedValue(new Error("Anthropic API hiccup"));

    const result = await sendWeeklySummaryForUser(user);

    expect(result).toEqual({ userId: user.id, sent: false, pushedDeviceCount: 0, failed: true });
  });

  it("pushes to every subscribed device and counts only the successful ones", async () => {
    const user = await makeUser();
    vi.mocked(generateWeeklySummary).mockResolvedValue("Summary text.");
    await upsertPushSubscription(user.id, { endpoint: "https://push.example/device-a", p256dh: "k", auth: "a" });
    await upsertPushSubscription(user.id, { endpoint: "https://push.example/device-b", p256dh: "k", auth: "a" });
    vi.mocked(sendPushNotification)
      .mockResolvedValueOnce({ sent: true, expired: false })
      .mockResolvedValueOnce({ sent: false, expired: false });

    const result = await sendWeeklySummaryForUser(user);

    expect(result.pushedDeviceCount).toBe(1);
    expect(sendPushNotification).toHaveBeenCalledTimes(2);
  });

  it("is a no-op — no query, no generation — when Ask isn't configured for this deployment", async () => {
    vi.mocked(isAssistantConfigured).mockReturnValue(false);
    await makeUser();

    const results = await sendWeeklySummaryForAllOptedInUsers();

    expect(results).toEqual([]);
    expect(generateWeeklySummary).not.toHaveBeenCalled();
  });

  it("only processes users who opted in, skipping everyone else", async () => {
    const optedIn = await makeUser(true);
    const optedOut = await makeUser(false);
    vi.mocked(generateWeeklySummary).mockResolvedValue("Summary text.");

    const results = await sendWeeklySummaryForAllOptedInUsers();

    expect(results.find((r) => r.userId === optedIn.id)).toBeDefined();
    expect(results.find((r) => r.userId === optedOut.id)).toBeUndefined();
  });

  it("keeps processing remaining users after one user's generation fails", async () => {
    const userA = await makeUser(true);
    const userB = await makeUser(true);
    vi.mocked(generateWeeklySummary).mockImplementation(async (userId: string) => {
      if (userId === userA.id) {
        throw new Error("boom");
      }
      return "Summary text.";
    });

    const results = await sendWeeklySummaryForAllOptedInUsers();

    expect(results.find((r) => r.userId === userA.id)?.failed).toBe(true);
    expect(results.find((r) => r.userId === userB.id)?.failed).toBe(false);
  });

  it("never mutates weeklyAskSummaryEnabled itself — the toggle is user-controlled only", async () => {
    const user = await makeUser(true);
    vi.mocked(generateWeeklySummary).mockResolvedValue("Summary text.");

    await sendWeeklySummaryForUser(user);

    const reloaded = await findUserById(user.id);
    expect(reloaded?.weeklyAskSummaryEnabled).toBe(true);
  });
});
