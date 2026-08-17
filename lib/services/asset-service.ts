import {
  createAsset,
  deleteAsset,
  findAssetById,
  findAssetsByUserId,
  updateAsset,
} from "@/lib/repositories/asset-repository";
import { NotFoundError } from "@/lib/services/account-service";
import type { AssetFormInput } from "@/lib/validation/asset";
import type { Asset } from "@/lib/generated/prisma/client";

export function listAssetsForUser(userId: string): Promise<Asset[]> {
  return findAssetsByUserId(userId);
}

export function addAssetForUser(userId: string, input: AssetFormInput): Promise<Asset> {
  return createAsset({
    user: { connect: { id: userId } },
    name: input.name,
    type: input.type,
    investedAmount: input.investedAmount,
    currentValue: input.currentValue,
    valuationAsOf: input.valuationAsOf,
    expectedAnnualReturnPercent: input.expectedAnnualReturnPercent ?? null,
    isJoint: input.isJoint,
    notes: input.notes ?? null,
  });
}

async function requireOwnedAsset(userId: string, assetId: string): Promise<Asset> {
  const asset = await findAssetById(assetId);
  if (!asset || asset.userId !== userId) {
    throw new NotFoundError("Asset");
  }
  return asset;
}

export async function editAssetForUser(
  userId: string,
  assetId: string,
  input: AssetFormInput,
): Promise<Asset> {
  await requireOwnedAsset(userId, assetId);
  return updateAsset(assetId, {
    name: input.name,
    type: input.type,
    investedAmount: input.investedAmount,
    currentValue: input.currentValue,
    valuationAsOf: input.valuationAsOf,
    expectedAnnualReturnPercent: input.expectedAnnualReturnPercent ?? null,
    isJoint: input.isJoint,
    notes: input.notes ?? null,
  });
}

export async function removeAssetForUser(userId: string, assetId: string): Promise<void> {
  await requireOwnedAsset(userId, assetId);
  await deleteAsset(assetId);
}
