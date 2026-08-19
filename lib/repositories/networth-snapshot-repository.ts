import { prisma } from "@/lib/prisma";
import type { NetWorthSnapshot, Prisma } from "@/lib/generated/prisma/client";

/** Creates or replaces the snapshot for a given IST calendar day (userId + capturedAt is unique). */
export function upsertNetWorthSnapshot(
  userId: string,
  capturedAt: Date,
  data: Omit<Prisma.NetWorthSnapshotCreateInput, "user" | "capturedAt">,
): Promise<NetWorthSnapshot> {
  return prisma.netWorthSnapshot.upsert({
    where: { userId_capturedAt: { userId, capturedAt } },
    create: { ...data, capturedAt, user: { connect: { id: userId } } },
    update: data,
  });
}

export function findNetWorthSnapshotsByUserId(userId: string): Promise<NetWorthSnapshot[]> {
  return prisma.netWorthSnapshot.findMany({
    where: { userId },
    orderBy: { capturedAt: "asc" },
  });
}

/** The most recent snapshot on or before the given date. */
export function findNetWorthSnapshotOnOrBefore(
  userId: string,
  date: Date,
): Promise<NetWorthSnapshot | null> {
  return prisma.netWorthSnapshot.findFirst({
    where: { userId, capturedAt: { lte: date } },
    orderBy: { capturedAt: "desc" },
  });
}
