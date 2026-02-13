import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateStoryModal } from "./CreateStoryModal";
import { StoryViewer } from "./StoryViewer";
import { Card } from "./ui/card";

interface Story {
  id: string;
  media_url: string;
  media_type: 'image' | 'video';
  content: string | null;
  created_at: string;
  viewed: boolean;
}
interface StoryGroup {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  stories: Story[];
  all_viewed: boolean;
}

interface StoryReelProps {
  currentUser: { id: string; full_name: string; avatar_url?: string };
}

const getInitials = (n: string) => {
  const a = n.trim().split(" ");
  return (a[0][0] + (a[1]?.[0] || a[0][1] || "")).toUpperCase();
};

export const StoryReel = ({ currentUser }: StoryReelProps) => {
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);

  const fetchStories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_recent_stories_grouped", {
        p_user_id: currentUser.id,
      });
      
      if (error) throw error;

      const allGroups = (data as unknown as StoryGroup[]).map(group => ({
        ...group,
        stories: group.stories || [],
      }));

      setStoryGroups(allGroups);

    } catch (e: any) {
      toast.error("Gagal memuat stories: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStories();
  }, [currentUser.id]);

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const handleStoryClick = (userId: string) => {
    const index = storyGroups.findIndex(g => g.user_id === userId);
    if (index !== -1) {
      setViewerStartIndex(index);
      setViewerOpen(true);
    } else {
      toast.error("Gagal menemukan story untuk pengguna ini.");
    }
  };

  const handleMarkStoriesAsViewed = (userId: string) => {
    setStoryGroups(prevGroups => 
      prevGroups.map(group => 
        group.user_id === userId ? { ...group, all_viewed: true } : group
      )
    );
  };

  const handleStoryDeleted = useCallback((userId: string, storyId: string) => {
    setStoryGroups(prevGroups => {
      return prevGroups.map(group => {
        if (group.user_id === userId) {
          const updatedStories = group.stories.filter(story => story.id !== storyId);
          return {
            ...group,
            stories: updatedStories,
          };
        }
        return group;
      })
      .filter(group => group.stories.length > 0);
    });
  }, []);

  return (
    <Card className="rounded-none lg:rounded-3xl border-0 lg:border border-white/10 bg-transparent lg:bg-card/30 shadow-none lg:shadow-xl p-6 mb-8 relative overflow-hidden backdrop-blur-md">
      {}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      <ScrollArea className="w-full whitespace-nowrap -mx-4 px-4 lg:mx-0 lg:px-0">
        <div className="flex w-max space-x-6 pb-2 pt-1 px-1">
          
          <div className="flex-shrink-0 w-20 text-center relative group">
            <button
              onClick={handleOpenCreateModal}
              className="relative h-20 w-20 rounded-full transition-transform transform active:scale-95 duration-300 group-hover:scale-105"
            >
              <Avatar className="h-full w-full border-2 border-dashed border-white/30 group-hover:border-primary transition-colors p-1">
                <AvatarImage src={currentUser.avatar_url} className="rounded-full object-cover" />
                <AvatarFallback className="bg-muted/80 rounded-full">
                  {getInitials(currentUser.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground ring-4 ring-card group-hover:scale-110 transition-transform shadow-lg">
                <Plus className="h-4 w-4" />
              </div>
            </button>
            <p className="mt-2 truncate text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
              Cerita Anda
            </p>
          </div>

          {loading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-20 text-center animate-pulse">
                <div className="h-20 w-20 rounded-full bg-white/5 mx-auto ring-1 ring-white/10" />
                <div className="mt-2 h-2.5 w-14 mx-auto bg-white/5 rounded-full" />
              </div>
            ))}

          {!loading &&
            storyGroups.map((group) => {
              const isMyStory = group.user_id === currentUser.id;
              
              const ringStyle = group.all_viewed
                ? "p-[2px] bg-white/20"
                : "p-[2px] bg-gradient-to-tr from-yellow-400 via-orange-500 to-red-500 shadow-[0_0_15px_-3px_rgba(249,115,22,0.5)]";

              return (
                <div
                  key={group.user_id}
                  className="flex-shrink-0 w-20 text-center group"
                >
                  <button
                    onClick={() => handleStoryClick(group.user_id)}
                    className={`h-20 w-20 rounded-full hover:opacity-90 transition-all transform active:scale-95 duration-300 ${ringStyle} group-hover:scale-105`}
                  >
                    <Avatar className="h-full w-full border-4 border-card rounded-full bg-card">
                      <AvatarImage src={group.avatar_url || undefined} className="object-cover" />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-sm font-bold">
                        {getInitials(group.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  <p className="mt-2 truncate text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    {isMyStory ? "Anda" : group.full_name.split(' ')[0]} 
                  </p>
                </div>
              );
            })}
        </div>
        <ScrollBar orientation="horizontal" className="h-2" />
      </ScrollArea>
      
      <CreateStoryModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        currentUser={currentUser}
        onStoryCreated={() => {
          fetchStories();
        }}
      />
      
      {viewerOpen && (
        <StoryViewer
          groups={storyGroups}
          initialUserIndex={viewerStartIndex}
          onClose={() => setViewerOpen(false)}
          currentUserId={currentUser.id}
          onAllStoriesViewed={handleMarkStoriesAsViewed}
          onStoryDeleted={handleStoryDeleted}
        />
      )}
    </Card>
  );
};