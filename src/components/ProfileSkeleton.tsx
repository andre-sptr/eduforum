import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ProfileSkeleton = () => {
  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <Card className="border-white/10 bg-card/40 backdrop-blur-xl p-8 rounded-3xl overflow-hidden relative shadow-xl">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
          {/* Avatar Skeleton */}
          <div className="relative group rounded-full">
            <Skeleton className="h-32 w-32 rounded-full border-4 border-card/50 shadow-2xl relative z-10 ring-4 ring-white/5" />
          </div>

          <div className="flex-1 text-center md:text-left space-y-5 w-full">
            <div>
              {/* Name Skeleton */}
              <Skeleton className="h-10 w-64 mx-auto md:mx-0 rounded-lg" />
              {/* Role Badge Skeleton */}
              <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>

            {/* Bio Skeleton */}
            <div className="space-y-2 max-w-lg mx-auto md:mx-0">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>

            {/* Rank Badges Skeleton */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
               <Skeleton className="h-7 w-32 rounded-xl" />
               <Skeleton className="h-7 w-32 rounded-xl" />
            </div>

            {/* Stats Skeleton */}
            <div className="flex items-center justify-center md:justify-start gap-8 py-2">
              <div className="space-y-1">
                <Skeleton className="h-8 w-12 mx-auto md:mx-0" />
                <Skeleton className="h-3 w-16 mx-auto md:mx-0" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-8 w-12 mx-auto md:mx-0" />
                <Skeleton className="h-3 w-16 mx-auto md:mx-0" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-8 w-12 mx-auto md:mx-0" />
                <Skeleton className="h-3 w-16 mx-auto md:mx-0" />
              </div>
            </div>

            {/* Action Buttons Skeleton */}
            <div className="flex items-center justify-center md:justify-start gap-3 pt-2">
              <Skeleton className="h-10 w-32 rounded-xl" />
              <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
          </div>
        </div>
      </Card>

      {/* Posts Filter Skeleton */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 p-1">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
        
        {/* Posts List Skeleton */}
        <div className="space-y-4">
           {/* We can reuse PostSkeleton here if we import it, or just generic cards */}
           <Card className="p-5 space-y-4 rounded-2xl">
             <div className="flex gap-4">
               <Skeleton className="h-12 w-12 rounded-full" />
               <div className="space-y-2 flex-1">
                 <Skeleton className="h-4 w-1/3" />
                 <Skeleton className="h-4 w-1/4" />
               </div>
             </div>
             <Skeleton className="h-24 w-full rounded-xl" />
           </Card>
           <Card className="p-5 space-y-4 rounded-2xl">
             <div className="flex gap-4">
               <Skeleton className="h-12 w-12 rounded-full" />
               <div className="space-y-2 flex-1">
                 <Skeleton className="h-4 w-1/3" />
                 <Skeleton className="h-4 w-1/4" />
               </div>
             </div>
             <Skeleton className="h-24 w-full rounded-xl" />
           </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfileSkeleton;
