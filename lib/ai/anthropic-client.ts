import Anthropic from "@anthropic-ai/sdk";

export const ASSISTANT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

let client: Anthropic | null = null;

export function isAssistantConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Returns the Anthropic client, or null when ANTHROPIC_API_KEY isn't
 * configured — mirrors lib/email/send-email.ts's lazy-getter pattern so
 * this never throws at import time. Callers (the /assistant page and its
 * API route) check {@link isAssistantConfigured} first and show a
 * "not configured" state rather than reaching this with no key.
 */
export function getClient(): Anthropic | null {
  if (client) {
    return client;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}
