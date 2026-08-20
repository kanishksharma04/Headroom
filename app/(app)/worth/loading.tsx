import { Skeleton } from "@/components/ui/skeleton";

export default function WorthLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>

      <Skeleton className="h-56 w-full rounded-xl" />

      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
