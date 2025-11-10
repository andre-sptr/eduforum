import { useEffect, useState, useMemo } from "react";
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
  media_type: 'image' | 'video' | 'spotify';
  content: string | null;
  created_at: string;
}
interface StoryGroup {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  stories: Story[];
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
      const { data, error } = await supabase.rpc("get_recent_stories")
        .select(`
          id, user_id, media_url, media_type, content, created_at,
          profiles ( id, full_name, avatar_url )
        `);
      
      if (error) throw error;

      const userStoryMap = new Map<string, StoryGroup>();
      
      for (const story of data as any[]) {
        if (!story.profiles) continue; 
        
        const profile = story.profiles as { id: string; full_name: string; avatar_url: string | null };
        const storyData: Story = {
          id: story.id,
          media_url: story.media_url,
          media_type: story.media_type,
          content: story.content,
          created_at: story.created_at,
        };

        if (!userStoryMap.has(profile.id)) {
          userStoryMap.set(profile.id, {
            user_id: profile.id,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            stories: [],
          });
        }
        userStoryMap.get(profile.id)!.stories.push(storyData);
      }

      const allGroups = Array.from(userStoryMap.values());

      const sortedGroups = allGroups.sort((a, b) => {
        if (a.user_id === currentUser.id) return -1;
        if (b.user_id === currentUser.id) return 1;
        return 0; 
      });

      setStoryGroups(sortedGroups);

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

  return (
    <Card className="rounded-none lg:rounded-2xl border-0 lg:border border-border/60 bg-transparent lg:bg-card/30 shadow-none lg:shadow-xl p-4 mb-6">
      <ScrollArea className="w-full whitespace-nowrap -mx-4 px-4">
        <div className="flex w-max space-x-3 pb-3">
          
          <div className="flex-shrink-0 w-16 text-center">
            <button
              onClick={handleOpenCreateModal}
              className="group relative h-16 w-16 rounded-full transition-transform transform active:scale-95"
            >
              <Avatar className="h-full w-full border-2 border-muted/60 group-hover:border-primary/70 transition-colors">
                <AvatarImage src={currentUser.avatar_url} />
                <AvatarFallback className="bg-muted/80">
                  {getInitials(currentUser.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-card group-hover:scale-110 transition-transform">
                <Plus className="h-4 w-4" />
              </div>
            </button>
            <p className="mt-1.5 truncate text-xs text-muted-foreground">
              Tambah
            </p>
          </div>

          {loading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-16 text-center">
                <Skeleton className="h-16 w-16 rounded-full" />
                <Skeleton className="mt-1.5 h-3 w-12 mx-auto" />
              </div>
            ))}

          {!loading &&
            storyGroups.map((group) => {
              const isMyStory = group.user_id === currentUser.id;
              
              return (
                <div
                  key={group.user_id}
                  className="flex-shrink-0 w-16 text-center"
                >
                  <button
                    onClick={() => handleStoryClick(group.user_id)}
                    className="h-16 w-16 rounded-full p-0.5 bg-gradient-to-tr from-primary via-primary/70 to-accent hover:opacity-90 transition-all transform active:scale-95"
                  >
                    <Avatar className="h-full w-full border-2 border-card">
                      <AvatarImage src={group.avatar_url} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                        {getInitials(group.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  <p className="mt-1.5 truncate text-xs text-muted-foreground">
                    {isMyStory ? "Anda" : group.full_name} 
                  </p>
                </div>
              );
            })}
        </div>
        <ScrollBar orientation="horizontal" className="h-1.5" />
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
        />
      )}
    </Card>
  );
};