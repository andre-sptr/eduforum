import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const MessagesSkeleton = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Tabs Skeleton */}
      <div className="w-full flex gap-2 mb-6 bg-muted/50 p-1 rounded-xl">
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Main Content Skeleton */}
      <Card className="flex-1 border-border bg-card shadow-xl rounded-2xl flex flex-col h-[calc(100vh-200px)] overflow-hidden">
        <div className="p-4 sm:p-6 flex-1 space-y-6">
           {/* Message List Item Skeleton */}
           {[...Array(5)].map((_, i) => (
             <div key={i} className="flex items-start gap-4">
               <Skeleton className="h-9 w-9 rounded-full shrink-0" />
               <div className="flex-1 space-y-2">
                 <div className="flex items-center gap-2">
                   <Skeleton className="h-4 w-24" />
                   <Skeleton className="h-3 w-12" />
                 </div>
                 <Skeleton className="h-12 w-full max-w-md rounded-2xl" />
               </div>
             </div>
           ))}
        </div>
        
        {/* Input Area Skeleton */}
        <div className="border-t border-border p-4 bg-card/80">
           <div className="flex gap-3 items-end max-w-5xl mx-auto">
             <Skeleton className="flex-1 h-12 rounded-2xl" />
             <Skeleton className="h-12 w-12 rounded-2xl shrink-0" />
           </div>
        </div>
      </Card>
    </div>
  );
};

export default MessagesSkeleton;
