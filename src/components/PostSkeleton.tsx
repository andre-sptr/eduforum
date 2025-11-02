import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const PostSkeleton = () => {
  return (
    <Card className="bg-card border-border p-6">
      <div className="flex items-start gap-4">
        {/* Avatar skeleton */}
        <Skeleton className="h-12 w-12 rounded-full" />
        
        <div className="flex-1 space-y-3">
          {/* Header skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
          
          {/* Content skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
          
          {/* Actions skeleton */}
          <div className="flex items-center gap-6 pt-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default PostSkeleton;
