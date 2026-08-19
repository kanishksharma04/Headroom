import type { NetWorthAttribution } from "@/lib/engines/networth";
import { formatMoneyShorthand } from "@/lib/format-money";

/**
 * Renders a net worth attribution as a plain-language sentence, e.g.
 * "Your net worth rose ₹1.2L this month: ₹45k contributed, ₹31k market
 * movement, ₹28k loan principal repaid." Only mentions buckets that
 * actually moved, so a quiet month isn't padded with "₹0 market movement".
 */
export function describeNetWorthAttribution(attribution: NetWorthAttribution): string {
  const parts: string[] = [];

  if (!attribution.contributions.isZero()) {
    const verb = attribution.contributions.isNegative() ? "withdrawn" : "contributed";
    parts.push(`${formatMoneyShorthand(attribution.contributions.abs())} ${verb}`);
  }
  if (!attribution.marketMovement.isZero()) {
    const direction = attribution.marketMovement.isNegative() ? "down" : "up";
    parts.push(`${formatMoneyShorthand(attribution.marketMovement.abs())} market movement (${direction})`);
  }
  if (!attribution.principalRepaid.isZero()) {
    const verb = attribution.principalRepaid.isNegative() ? "added" : "repaid";
    parts.push(`${formatMoneyShorthand(attribution.principalRepaid.abs())} loan principal ${verb}`);
  }
  if (!attribution.other.isZero()) {
    parts.push(`${formatMoneyShorthand(attribution.other.abs())} in other changes`);
  }

  const verb = attribution.totalChange.isZero()
    ? "was unchanged"
    : attribution.totalChange.isNegative()
      ? "fell"
      : "rose";
  const amount = attribution.totalChange.isZero()
    ? ""
    : ` ${formatMoneyShorthand(attribution.totalChange.abs())}`;

  if (parts.length === 0) {
    return `Your net worth ${verb}${amount}.`;
  }

  return `Your net worth ${verb}${amount}: ${parts.join(", ")}.`;
}
