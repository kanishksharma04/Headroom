import { Skeleton } from "@/components/ui/skeleton";

export default function AheadLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
