import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const GroupSkeleton = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Skeleton */}
      <Card className="rounded-2xl bg-card shadow-xl border border-border p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
             <div className="flex items-center gap-4 w-full md:w-auto">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex items-center gap-3">
                     <Skeleton className="h-10 w-10 rounded-full" />
                </div>
             </div>

             <div className="relative flex-1 w-full">
                <Skeleton className="h-11 w-full rounded-xl" />
             </div>

             <Skeleton className="h-11 w-32 rounded-xl" />
        </div>
      </Card>

      {/* Tabs Skeleton */}
      <div className="rounded-2xl bg-card shadow-xl border border-border">
         <div className="p-3 sm:p-4 space-y-4">
            <div className="grid w-full grid-cols-2 mb-6 gap-2">
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="flex flex-col h-full overflow-hidden rounded-2xl border-border bg-card/50 shadow-sm">
                  <div className="relative h-24 bg-muted/30">
                    <Skeleton className="absolute inset-0 w-full h-full" />
                    <div className="absolute -bottom-6 left-4 rounded-xl p-1 bg-card shadow-lg ring-1 ring-border/50">
                      <Skeleton className="h-12 w-12 rounded-lg" />
                    </div>
                  </div>
                  <div className="flex flex-col flex-1 p-4 pt-8">
                    <div className="flex items-start justify-between mb-2">
                      <div className="space-y-2 w-full">
                        <Skeleton className="h-5 w-3/4 rounded-md" />
                        <Skeleton className="h-3 w-1/2 rounded-md" />
                      </div>
                    </div>
                    
                    <div className="space-y-2 mt-2 mb-4">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-5/6" />
                    </div>

                    <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between">
                       <div className="flex -space-x-2">
                         <Skeleton className="h-6 w-6 rounded-full ring-2 ring-card" />
                         <Skeleton className="h-6 w-6 rounded-full ring-2 ring-card" />
                         <Skeleton className="h-6 w-6 rounded-full ring-2 ring-card" />
                       </div>
                       <Skeleton className="h-8 w-20 rounded-lg" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
         </div>
      </div>
    </div>
  );
};

export default GroupSkeleton;
