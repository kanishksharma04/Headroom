import { Skeleton } from "@/components/ui/skeleton";

export default function DecideLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-36" />
      </div>

      <div className="flex flex-col gap-4 rounded-xl border p-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="h-24 w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
