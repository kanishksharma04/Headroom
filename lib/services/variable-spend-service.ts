import {
  findVariableSpendBaselineByUserId,
  upsertVariableSpendBaseline,
} from "@/lib/repositories/variable-spend-baseline-repository";
import type { VariableSpendFormInput } from "@/lib/validation/variable-spend";
import type { VariableSpendBaseline } from "@/lib/generated/prisma/client";

export function getVariableSpendBaselineForUser(
  userId: string,
): Promise<VariableSpendBaseline | null> {
  return findVariableSpendBaselineByUserId(userId);
}

export function setVariableSpendBaselineForUser(
  userId: string,
  input: VariableSpendFormInput,
): Promise<VariableSpendBaseline> {
  return upsertVariableSpendBaseline(userId, {
    monthlyAmount: input.monthlyAmount,
    source: "USER_ESTIMATE",
  });
}
