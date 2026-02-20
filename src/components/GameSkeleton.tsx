import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const GameSkeleton = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
       {/* User Header Skeleton */}
       <Card className="rounded-2xl bg-card shadow-xl border border-border p-4">
          <div className="flex gap-4 items-center">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="relative flex-1">
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          </div>
        </Card>

        {/* Games Grid Skeleton */}
        <div className="rounded-2xl bg-card shadow-xl border border-border">
          <div className="p-4 space-y-4">
             {/* Tabs Skeleton */}
             <div className="grid w-full grid-cols-2 mb-6 gap-2">
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="flex flex-col overflow-hidden rounded-xl border-border bg-card/50 shadow-sm h-64">
                    <div className="relative h-32 bg-muted/30">
                       <Skeleton className="absolute inset-0 w-full h-full" />
                    </div>
                    <div className="p-4 space-y-3 flex-1">
                       <Skeleton className="h-5 w-3/4" />
                       <Skeleton className="h-3 w-full" />
                       <Skeleton className="h-3 w-5/6" />
                    </div>
                    <div className="p-4 pt-0 mt-auto">
                       <Skeleton className="h-9 w-full rounded-lg" />
                    </div>
                  </Card>
                ))}
             </div>
          </div>
        </div>
    </div>
  );
};

export default GameSkeleton;
