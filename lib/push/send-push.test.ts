import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

describe("send-push", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("reports unconfigured, and skips sending, when VAPID keys are unset", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    const { isPushConfigured, getPushPublicKey, sendPushNotification } = await import("@/lib/push/send-push");
    const webpush = (await import("web-push")).default;

    expect(isPushConfigured()).toBe(false);
    expect(getPushPublicKey()).toBeNull();

    const result = await sendPushNotification(
      { endpoint: "https://push.example/abc", p256dh: "key", auth: "secret" },
      { title: "Test", body: "Body", url: "/today" },
    );

    expect(result).toEqual({ sent: false, expired: false });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("sends and reports success when VAPID keys are configured", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "test-public-key");
    vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key");
    const { isPushConfigured, sendPushNotification } = await import("@/lib/push/send-push");
    const webpush = (await import("web-push")).default;
    vi.mocked(webpush.sendNotification).mockResolvedValue({ statusCode: 201, body: "", headers: {} });

    expect(isPushConfigured()).toBe(true);

    const result = await sendPushNotification(
      { endpoint: "https://push.example/abc", p256dh: "key", auth: "secret" },
      { title: "Test", body: "Body", url: "/today" },
    );

    expect(result).toEqual({ sent: true, expired: false });
    expect(webpush.setVapidDetails).toHaveBeenCalledOnce();
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint: "https://push.example/abc", keys: { p256dh: "key", auth: "secret" } },
      JSON.stringify({ title: "Test", body: "Body", url: "/today" }),
    );
  });

  it("reports expired, not a generic failure, when the push service returns 410 Gone", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "test-public-key");
    vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key");
    const { sendPushNotification } = await import("@/lib/push/send-push");
    const webpush = (await import("web-push")).default;
    const error = Object.assign(new Error("Gone"), { statusCode: 410 });
    vi.mocked(webpush.sendNotification).mockRejectedValue(error);

    const result = await sendPushNotification(
      { endpoint: "https://push.example/dead", p256dh: "key", auth: "secret" },
      { title: "Test", body: "Body", url: "/today" },
    );

    expect(result).toEqual({ sent: false, expired: true });
  });

  it("reports a plain failure, not expired, for any other error", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "test-public-key");
    vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key");
    const { sendPushNotification } = await import("@/lib/push/send-push");
    const webpush = (await import("web-push")).default;
    const error = Object.assign(new Error("Server error"), { statusCode: 500 });
    vi.mocked(webpush.sendNotification).mockRejectedValue(error);

    const result = await sendPushNotification(
      { endpoint: "https://push.example/flaky", p256dh: "key", auth: "secret" },
      { title: "Test", body: "Body", url: "/today" },
    );

    expect(result).toEqual({ sent: false, expired: false });
  });
});
