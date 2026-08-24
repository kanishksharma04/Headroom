// @vitest-environment node
//
// The Anthropic SDK refuses to construct a client in a browser-like
// environment (it detects `window`) as a safeguard against shipping an API
// key into a client bundle. This test's whole point is constructing a real
// client, so it needs the plain node environment rather than this repo's
// jsdom default (used for component tests).
import { afterEach, describe, expect, it, vi } from "vitest";

describe("anthropic-client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reports unconfigured and returns no client when ANTHROPIC_API_KEY is unset", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const { isAssistantConfigured, getClient } = await import("@/lib/ai/anthropic-client");

    expect(isAssistantConfigured()).toBe(false);
    expect(getClient()).toBeNull();
  });

  it("reports configured and returns a client when ANTHROPIC_API_KEY is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const { isAssistantConfigured, getClient } = await import("@/lib/ai/anthropic-client");

    expect(isAssistantConfigured()).toBe(true);
    // Construction never makes a network call — safe to assert without mocking fetch.
    expect(getClient()).not.toBeNull();
  });

  it("defaults the model to claude-sonnet-5 when ANTHROPIC_MODEL is unset", async () => {
    vi.stubEnv("ANTHROPIC_MODEL", "");
    const { ASSISTANT_MODEL } = await import("@/lib/ai/anthropic-client");
    expect(ASSISTANT_MODEL).toBe("claude-sonnet-5");
  });
});
