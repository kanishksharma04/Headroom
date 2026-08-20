import { Skeleton } from "@/components/ui/skeleton";

export default function RecordsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-48" />
      </div>

      <Skeleton className="h-10 w-full rounded-md" />

      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border p-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}
