import { Skeleton } from "@/components/ui/skeleton";

export default function TodayLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-10 px-6 py-10">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-16 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-3 h-2 w-64 rounded-full" />
      </div>
      <Skeleton className="h-24 w-full max-w-sm rounded-xl" />
    </div>
  );
}
