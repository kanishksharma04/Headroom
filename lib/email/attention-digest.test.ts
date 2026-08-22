import { describe, expect, it } from "vitest";
import { buildAttentionDigestEmail } from "@/lib/email/attention-digest";
import type { AttentionItem } from "@/lib/engines/attention";
import { toMoney } from "@/lib/money";

function item(overrides: Partial<AttentionItem>): AttentionItem {
  return {
    kind: "PROJECTED_SHORTFALL",
    message: "Your balance is projected to go negative around 5 Sep.",
    amount: toMoney("-1500"),
    date: null,
    sourceId: null,
    ...overrides,
  };
}

describe("buildAttentionDigestEmail", () => {
  it("uses singular phrasing for exactly one item", () => {
    const email = buildAttentionDigestEmail("Asha", [item({})], "https://headroom.app");
    expect(email.subject).toBe("Headroom: 1 thing needs your attention");
  });

  it("uses plural phrasing for more than one item", () => {
    const email = buildAttentionDigestEmail(
      "Asha",
      [item({ sourceId: "a" }), item({ sourceId: "b" })],
      "https://headroom.app",
    );
    expect(email.subject).toBe("Headroom: 2 things need your attention");
  });

  it("includes every item's message verbatim in both the text and html bodies", () => {
    const items = [
      item({ message: "Rent is projected to bounce on 5 Sep." }),
      item({ message: "Home Loan balance is overdue for review." }),
    ];
    const email = buildAttentionDigestEmail("Asha", items, "https://headroom.app");

    for (const i of items) {
      expect(email.text).toContain(i.message);
      expect(email.html).toContain(i.message);
    }
  });

  it("greets the user by name and links back to the app", () => {
    const email = buildAttentionDigestEmail("Asha", [item({})], "https://headroom.app");
    expect(email.text).toContain("Hi Asha,");
    expect(email.html).toContain("Hi Asha,");
    expect(email.html).toContain('href="https://headroom.app/today"');
  });

  it("escapes HTML-significant characters in the message so a stray < or & can't break the markup", () => {
    const email = buildAttentionDigestEmail(
      "Asha",
      [item({ message: "Rent & Utilities < 0 balance" })],
      "https://headroom.app",
    );
    expect(email.html).toContain("Rent &amp; Utilities &lt; 0 balance");
    expect(email.html).not.toContain("Rent & Utilities < 0 balance");
  });
});
