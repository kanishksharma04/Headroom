import { prisma } from "@/lib/prisma";
import type { Asset, Prisma } from "@/lib/generated/prisma/client";

export function createAsset(data: Prisma.AssetCreateInput): Promise<Asset> {
  return prisma.asset.create({ data });
}

export function findAssetById(id: string): Promise<Asset | null> {
  return prisma.asset.findUnique({ where: { id } });
}

export function findAssetsByUserId(userId: string): Promise<Asset[]> {
  return prisma.asset.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

export function updateAsset(id: string, data: Prisma.AssetUpdateInput): Promise<Asset> {
  return prisma.asset.update({ where: { id }, data });
}

export function deleteAsset(id: string): Promise<Asset> {
  return prisma.asset.delete({ where: { id } });
}
