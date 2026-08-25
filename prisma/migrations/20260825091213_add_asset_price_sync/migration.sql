-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "amfiSchemeCode" TEXT,
ADD COLUMN     "lastPriceSyncAt" TIMESTAMP(3),
ADD COLUMN     "lastPriceSyncError" TEXT,
ADD COLUMN     "unitsHeld" DECIMAL(18,4);
