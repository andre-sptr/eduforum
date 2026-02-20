import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const ChatSkeleton = () => {
  return (
    <div className="space-y-4 h-[505px] flex flex-col animate-in fade-in duration-500">
      {/* Header Skeleton */}
      <header className="border-b border-border bg-card shadow-sm rounded-t-2xl z-20 sticky top-0 px-6 py-4 flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32 rounded-md" />
          <Skeleton className="h-3 w-20 rounded-md" />
        </div>
      </header>

      {/* Messages Area Skeleton */}
      <Card className="flex-1 border-border bg-card shadow-xl overflow-hidden flex flex-col h-full rounded-b-2xl rounded-t-none mt-0 relative">
        <div className="flex-1 p-6 space-y-6">
          {/* Incoming Message */}
          <div className="flex items-end gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2 max-w-[60%]">
               <div className="flex items-center gap-2">
                 <Skeleton className="h-3 w-20" />
               </div>
               <Skeleton className="h-16 w-full rounded-2xl rounded-tl-sm" />
            </div>
          </div>

          {/* Outgoing Message */}
          <div className="flex items-end gap-3 flex-row-reverse">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2 max-w-[60%] items-end flex flex-col">
               <div className="flex items-center gap-2">
                 <Skeleton className="h-3 w-20" />
               </div>
               <Skeleton className="h-12 w-48 rounded-2xl rounded-tr-sm" />
            </div>
          </div>

          {/* Incoming Message */}
          <div className="flex items-end gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2 max-w-[50%]">
               <div className="flex items-center gap-2">
                 <Skeleton className="h-3 w-20" />
               </div>
               <Skeleton className="h-10 w-full rounded-2xl rounded-tl-sm" />
            </div>
          </div>

           {/* Outgoing Message */}
           <div className="flex items-end gap-3 flex-row-reverse">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2 max-w-[70%] items-end flex flex-col">
               <div className="flex items-center gap-2">
                 <Skeleton className="h-3 w-20" />
               </div>
               <Skeleton className="h-24 w-full rounded-2xl rounded-tr-sm" />
            </div>
          </div>
        </div>

        {/* Input Area Skeleton */}
        <div className="border-t border-border p-4 bg-card">
          <div className="flex gap-3 max-w-4xl mx-auto items-end">
            <Skeleton className="flex-1 h-12 rounded-2xl" />
            <Skeleton className="h-12 w-12 rounded-2xl" />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ChatSkeleton;
