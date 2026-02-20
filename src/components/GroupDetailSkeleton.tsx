import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import PostSkeleton from "@/components/PostSkeleton";

const GroupDetailSkeleton = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Group Header Skeleton */}
      <Card className="overflow-hidden border-border bg-card/50 shadow-xl rounded-2xl">
        <div className="h-32 md:h-48 bg-muted/30 relative">
          <Skeleton className="w-full h-full" />
        </div>
        <div className="p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row gap-6 md:items-start justify-between">
            <div className="space-y-4 flex-1">
              <div className="space-y-2">
                <Skeleton className="h-8 w-3/4 max-w-md rounded-lg" />
                <Skeleton className="h-4 w-1/2 max-w-sm" />
              </div>
              <div className="flex flex-wrap gap-4 pt-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2 md:pt-0">
               <Skeleton className="h-10 w-32 rounded-xl" />
               <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
          </div>
          
          <div className="pt-4 border-t border-border/50">
             <div className="flex gap-2">
                <Skeleton className="h-9 w-24 rounded-lg" />
                <Skeleton className="h-9 w-24 rounded-lg" />
             </div>
          </div>
        </div>
      </Card>

      {/* Feed Area Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-6">
            {/* Create Post Area Skeleton */}
            <Card className="p-4 rounded-2xl border-border bg-card shadow-sm mb-6">
               <div className="flex gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="flex-1 h-10 rounded-xl" />
               </div>
            </Card>

            {/* Posts Skeleton */}
            <div className="space-y-6">
               <PostSkeleton />
               <PostSkeleton />
            </div>
         </div>

         {/* Sidebar Skeleton (Members/Info) */}
         <div className="hidden lg:block space-y-6">
            <Card className="p-6 rounded-2xl border-border bg-card shadow-sm space-y-6">
               <Skeleton className="h-6 w-32 mb-4" />
               {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                     <Skeleton className="h-8 w-8 rounded-full" />
                     <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-2 w-16" />
                     </div>
                  </div>
               ))}
            </Card>
         </div>
      </div>
    </div>
  );
};

export default GroupDetailSkeleton;
