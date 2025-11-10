import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { X, Loader2, Pause, Play, Trash2, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useStoryTimer } from "@/hooks/useStoryTimer";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Story {
  id: string;
  media_url: string;
  media_type: 'image' | 'video' | 'spotify';
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
interface StoryViewerProps {
  groups: StoryGroup[];
  initialUserIndex: number;
  onClose: () => void;
  currentUserId: string;
  onAllStoriesViewed: (userId: string) => void;
  onStoryDeleted: (userId: string, storyId: string) => void;
}

const STORY_DURATION_S = 5;
const STORY_DURATION_MS = STORY_DURATION_S * 1000;

const getInitials = (n: string) => {
  const a = n.trim().split(" ");
  return (a[0][0] + (a[1]?.[0] || a[0][1] || "")).toUpperCase();
};

export const StoryViewer = ({
  groups,
  initialUserIndex,
  onClose,
  currentUserId,
  onAllStoriesViewed,
  onStoryDeleted,
}: StoryViewerProps) => {
  const [currentUserIndex, setCurrentUserIndex] = useState(initialUserIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  const activeGroup = useMemo(() => groups[currentUserIndex], [groups, currentUserIndex]);
  const activeStory = useMemo(() => activeGroup?.stories[currentStoryIndex], [activeGroup, currentStoryIndex]);

  const markStoryAsViewed = useCallback(async (storyId: string) => {
    if (!currentUserId || !storyId) return;
    supabase
      .from("story_views")
      .upsert(
        { story_id: storyId, user_id: currentUserId },
        { onConflict: 'story_id, user_id', ignoreDuplicates: true }
      )
      .then();
  }, [currentUserId]);

  const goToNextStory = useCallback(() => {
    if (!activeGroup) {
      onClose();
      return;
    }
    if (currentStoryIndex < activeGroup.stories.length - 1) {
      setCurrentStoryIndex(i => i + 1);
    } else {
      onAllStoriesViewed(activeGroup.user_id);
      goToNextUser();
    }
  }, [activeGroup, currentStoryIndex, onAllStoriesViewed, onClose]);

  const goToPrevStory = useCallback(() => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(i => i - 1);
    } else {
      goToPrevUser();
    }
  }, [currentStoryIndex]);

  const goToNextUser = useCallback(() => {
    if (currentUserIndex < groups.length - 1) {
      setCurrentUserIndex(i => i + 1);
      setCurrentStoryIndex(0);
    } else {
      onClose();
    }
  }, [currentUserIndex, groups.length, onClose]);

  const goToPrevUser = useCallback(() => {
    if (currentUserIndex > 0) {
      setCurrentUserIndex(i => i - 1);
      setCurrentStoryIndex(groups[currentUserIndex - 1].stories.length - 1);
    }
  }, [currentUserIndex, groups]);

  const storyDuration = useMemo(() => {
    if (activeStory?.media_type === 'video' && videoRef.current?.duration) {
      return (videoRef.current.duration || STORY_DURATION_S) * 1000;
    }
    return STORY_DURATION_MS;
  }, [activeStory, videoRef.current?.duration]);

  const progress = useStoryTimer(activeStory?.id, storyDuration, isPaused || isLoading, goToNextStory);

  useEffect(() => {
    if (!activeStory) {
      goToNextStory();
      return;
    }
    
    setIsLoading(true);
    markStoryAsViewed(activeStory.id);
    
    if (activeStory.media_type === 'image') {
      const img = new Image();
      img.src = activeStory.media_url;
      img.onload = () => setIsLoading(false);
      img.onerror = () => {
        toast.error("Gagal memuat story");
        goToNextStory();
      };
    } else if (activeStory.media_type === 'video') {
      if (videoRef.current) {
        videoRef.current.src = activeStory.media_url;
        
        videoRef.current.onerror = () => {
          toast.error("Gagal memuat video story");
          goToNextStory();
        };

        videoRef.current.load();
      }
    }
    
  }, [activeStory, markStoryAsViewed, goToNextStory]);

  useEffect(() => {
    if (activeStory?.media_type === 'video' && videoRef.current) {
      if (isPaused) {
        videoRef.current.pause();
      } else if (!isLoading) {
        videoRef.current.play().catch(e => console.warn("Autoplay gagal:", e));
      }
    }
  }, [isPaused, isLoading, activeStory]);

  const handleMouseDown = (e: React.MouseEvent) => setIsPaused(true);
  const handleMouseUp = (e: React.MouseEvent) => setIsPaused(false);
  const handleTouchStart = (e: React.TouchEvent) => setIsPaused(true);
  const handleTouchEnd = (e: React.TouchEvent) => setIsPaused(false);
  
  const handleNavClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPaused) return; 
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickZone = rect.width * 0.3; 
    
    if (clickX < clickZone) {
      goToPrevStory();
    } else {
      goToNextStory();
    }
  };
  
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleDeleteStory = async () => {
    if (!activeStory) return;
    setIsDeleteConfirmOpen(false);

    try {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', activeStory.id)
        .eq('user_id', currentUserId);

      if (error) throw error;

      toast.success("Story berhasil dihapus.");

      onStoryDeleted(activeGroup.user_id, activeStory.id);

      if (activeGroup.stories.length === 1) {
        goToNextUser();
      }
      
    } catch (e: any) {
      toast.error("Gagal menghapus story: " + e.message);
    }
  };

  if (!activeGroup || !activeStory) return null;

  const isMyStory = activeGroup.user_id === currentUserId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div 
        className="relative h-full w-full max-w-md max-h-[95vh] aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-2xl transform scale-95 animate-zoom-in"
        onClick={(e) => e.stopPropagation()}
      >
        
        <div 
          className="absolute inset-0 bg-cover bg-center filter blur-xl transform scale-105 opacity-30 transition-all duration-300" 
          style={{ backgroundImage: `url(${activeStory.media_url})` }}
        />

        <div className="absolute inset-0 flex items-center justify-center">
          {isLoading && <Loader2 className="h-8 w-8 text-white animate-spin" />}
          
          {activeStory.media_type === 'image' && (
            <img 
              src={activeStory.media_url} 
              className={cn("w-full h-full object-contain transition-opacity duration-300", isLoading ? "opacity-0" : "opacity-100")}
              alt="Story" 
            />
          )}
          
          {activeStory.media_type === 'video' && (
            <video
              ref={videoRef}
              src={activeStory.media_url}
              className={cn("w-full h-full object-contain transition-opacity duration-300", isLoading ? "opacity-0" : "opacity-100")}
              playsInline
              muted 
              onLoadedData={() => setIsLoading(false)}
              onEnded={goToNextStory}
              onClick={(e) => e.stopPropagation()} 
            />
          )}
        </div>
        
        <div 
          className="absolute inset-0 flex z-10 cursor-pointer"
          onClick={handleNavClick}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-1/3 h-full" />
          <div className="w-2/3 h-full" />
        </div>

        <div 
          className="absolute top-0 left-0 right-0 p-4 space-y-2 bg-gradient-to-b from-black/60 to-transparent z-20"
        >
          <div className="flex w-full gap-1 shadow-sm rounded-full overflow-hidden">
            {activeGroup.stories.map((story, index) => (
              <div key={index} className="flex-1 h-1.5 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white"
                  style={{
                    width: `${
                      index < currentStoryIndex ? 100 : (index === currentStoryIndex ? progress : 0)
                    }%`,
                  }}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Link to={`/profile/${activeGroup.user_id}`} onClick={(e) => e.stopPropagation()}>
              <Avatar className="h-10 w-10 border-2 border-white/80 transition-transform hover:scale-105">
                <AvatarImage src={activeGroup.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">{getInitials(activeGroup.full_name)}</AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1">
              <Link to={`/profile/${activeGroup.user_id}`} onClick={(e) => e.stopPropagation()}>
                <p className="font-semibold text-white text-sm [text-shadow:0_1px_3px_rgb(0_0_0_/_0.4)] hover:underline">{activeGroup.full_name}</p>
              </Link>
              <p className="text-xs text-white/80 [text-shadow:0_1px_3px_rgb(0_0_0_/_0.4)]">
                {formatDistanceToNow(new Date(activeStory.created_at), { locale: id })} lalu
              </p>
            </div>
            
            {isMyStory && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white/80 hover:text-red-400 hover:bg-white/10 rounded-full transition-all" 
                onClick={(e) => { e.stopPropagation(); setIsPaused(true); setIsDeleteConfirmOpen(true); }}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            )}

            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all" 
              onClick={(e) => { e.stopPropagation(); setIsPaused(p => !p); }}
            >
              {isPaused ? <Play className="h-5 w-5 fill-white" /> : <Pause className="h-5 w-5 fill-white" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all" 
              onClick={(e) => { e.stopPropagation(); onClose(); }}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>
        
        {activeStory.content && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent z-20">
            <p className="text-white text-sm text-center [text-shadow:0_1px_3px_rgb(0_0_0_/_0.6)]">
              {activeStory.content}
            </p>
          </div>
        )}
      </div>

      <AlertDialog 
        open={isDeleteConfirmOpen} 
        onOpenChange={(open) => {
          setIsDeleteConfirmOpen(open);
          if (!open) setIsPaused(false);
        }}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Konfirmasi Hapus Story</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Apakah Anda yakin ingin menghapus story ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteStory} 
              className="bg-red-500 hover:bg-red-600 text-white rounded-lg"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};