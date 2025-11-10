import { useState, useEffect, useRef, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, Loader2, Pause, Play } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
interface StoryViewerProps {
  groups: StoryGroup[];
  initialUserIndex: number;
  onClose: () => void;
}

const STORY_DURATION_S = 5;
const STORY_DURATION_MS = STORY_DURATION_S * 1000;

const getInitials = (n: string) => {
  const a = n.trim().split(" ");
  return (a[0][0] + (a[1]?.[0] || a[0][1] || "")).toUpperCase();
};

export const StoryViewer = ({ groups, initialUserIndex, onClose }: StoryViewerProps) => {
  const [currentUserIndex, setCurrentUserIndex] = useState(initialUserIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const activeGroup = useMemo(() => groups[currentUserIndex], [groups, currentUserIndex]);
  const activeStory = useMemo(() => activeGroup?.stories[currentStoryIndex], [activeGroup, currentStoryIndex]);

  const goToNextStory = () => {
    if (activeGroup && currentStoryIndex < activeGroup.stories.length - 1) {
      setCurrentStoryIndex(i => i + 1);
    } else {
      goToNextUser();
    }
  };

  const goToPrevStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(i => i - 1);
    } else {
      goToPrevUser();
    }
  };

  const goToNextUser = () => {
    if (currentUserIndex < groups.length - 1) {
      setCurrentUserIndex(i => i + 1);
      setCurrentStoryIndex(0);
    } else {
      onClose();
    }
  };

  const goToPrevUser = () => {
    if (currentUserIndex > 0) {
      setCurrentUserIndex(i => i - 1);
      setCurrentStoryIndex(0);
    }
  };

  const clearIntervals = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    timerRef.current = null;
    progressTimerRef.current = null;
  };
  
  const startTimer = (startProgress: number) => {
    clearIntervals();
    setIsLoading(false);
    if (isPaused) return;

    setProgress(startProgress);

    if (activeStory.media_type === 'video' && videoRef.current) {
      const video = videoRef.current;
      video.currentTime = (startProgress / 100) * video.duration;
      video.play().catch(e => console.error("Autoplay gagal:", e));
      
      progressTimerRef.current = setInterval(() => {
        if (video.duration && !video.paused) {
          setProgress((video.currentTime / video.duration) * 100);
        }
      }, 100);
    
    } else if (activeStory.media_type === 'image') {
      const timeElapsed = (startProgress / 100) * STORY_DURATION_MS;
      const timeRemaining = STORY_DURATION_MS - timeElapsed;
      const updatesPerSecond = 10;
      const totalUpdates = STORY_DURATION_S * updatesPerSecond;
      const progressPerUpdate = 100 / totalUpdates;
      const intervalDuration = 1000 / updatesPerSecond;

      progressTimerRef.current = setInterval(() => {
        setProgress(p => {
          const newProgress = p + progressPerUpdate;
          if (newProgress >= 100) {
            clearInterval(progressTimerRef.current!);
            return 100;
          }
          return newProgress;
        });
      }, intervalDuration); 
      
      timerRef.current = setTimeout(goToNextStory, timeRemaining);
    }
  };

  useEffect(() => {
    if (!activeStory) return; 
    
    setIsLoading(true);
    setProgress(0);
    clearIntervals();
    
    if (activeStory.media_type === 'image') {
      const img = new Image();
      img.src = activeStory.media_url;
      img.onload = () => {
        if (!isPaused) {
          startTimer(0);
        } else {
          setIsLoading(false);
        }
      };
      img.onerror = () => {
        toast.error("Gagal memuat story");
        goToNextStory();
      };
    } else if (activeStory.media_type === 'video') {
      if (videoRef.current) {
        videoRef.current.src = activeStory.media_url;
        videoRef.current.load();
      }
    }
    return clearIntervals;
  }, [activeStory]);

  useEffect(() => {
    if (isPaused) {
      clearIntervals();
      if (videoRef.current) {
        videoRef.current.pause();
      }
    } else {
      if (!isLoading && activeStory) {
        startTimer(progress);
      }
    }
  }, [isPaused]); 

  if (!activeGroup || !activeStory) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPaused(true);
  };
  const handleMouseUp = (e: React.MouseEvent) => {
    setIsPaused(false);
  };
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsPaused(false);
  };

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
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div 
        className="relative h-full w-full max-w-md max-h-[95vh] aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        
        {activeStory.media_type === 'image' && (
          <div
            className="absolute inset-0 bg-cover bg-center filter blur-xl scale-110 opacity-50"
            style={{ backgroundImage: `url(${activeStory.media_url})` }}
          />
        )}
        {activeStory.media_type === 'video' && (
          <video
            src={activeStory.media_url}
            className="absolute inset-0 object-cover filter blur-xl scale-110 opacity-50"
            playsInline muted loop autoPlay
          />
        )}

        <div className="absolute inset-0 flex items-center justify-center">
          {isLoading && <Loader2 className="h-8 w-8 text-white animate-spin" />}
          
          {activeStory.media_type === 'image' && (
            <img 
              src={activeStory.media_url} 
              className={cn("w-full h-full object-contain", isLoading ? "invisible" : "visible")}
              alt="Story" 
            />
          )}
          
          {activeStory.media_type === 'video' && (
            <video
              ref={videoRef}
              src={activeStory.media_url}
              className={cn("w-full h-full object-contain", isLoading ? "invisible" : "visible")}
              playsInline
              muted 
              onLoadedData={() => {
                if (!isPaused) {
                  startTimer(0);
                } else {
                  setIsLoading(false);
                }
              }}
              onEnded={goToNextStory}
              onClick={(e) => e.stopPropagation()} 
            />
          )}
        </div>
        
        <div 
          className="absolute inset-0 flex z-10"
          onClick={handleNavClick}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div 
            className="w-[30%] h-full" 
            onClick={(e) => { 
              e.stopPropagation(); 
              if (!isPaused) goToPrevStory(); 
            }} 
          />
          <div 
            className="w-[70%] h-full"
            onClick={(e) => {
              e.stopPropagation();
              if (!isPaused) goToNextStory();
            }}
          />
        </div>

        <div 
          className="absolute top-0 left-0 right-0 p-4 space-y-2 bg-gradient-to-b from-black/60 to-transparent z-20"
        >
          <div className="flex w-full gap-1">
            {activeGroup.stories.map((_, index) => (
              <div key={index} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-1 bg-white transition-all duration-100 ease-linear"
                  style={{ width: `${
                    index < currentStoryIndex ? 100 : (index === currentStoryIndex ? progress : 0)
                  }%`}}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Link to={`/profile/${activeGroup.user_id}`} onClick={(e) => e.stopPropagation()}>
              <Avatar className="h-10 w-10 border-2 border-white/80">
                <AvatarImage src={activeGroup.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">{getInitials(activeGroup.full_name)}</AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1">
              <Link to={`/profile/${activeGroup.user_id}`} onClick={(e) => e.stopPropagation()}>
                <p className="font-semibold text-white text-sm [text-shadow:0_1px_3px_rgb(0_0_0_/_0.4)]">{activeGroup.full_name}</p>
              </Link>
              <p className="text-xs text-white/80 [text-shadow:0_1px_3px_rgb(0_0_0_/_0.4)]">
                {formatDistanceToNow(new Date(activeStory.created_at), { locale: id })} lalu
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all" 
              onClick={(e) => { e.stopPropagation(); setIsPaused(p => !p); }}
            >
              {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
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
          <div 
            className="absolute bottom-0 left-0 right-0 p-4 pb-8 text-center bg-gradient-to-t from-black/60 to-transparent z-20"
          >
            <p className="text-white text-sm [text-shadow:0_1px_4px_rgb(0_0_0_/_0.5)]">{activeStory.content}</p>
          </div>
        )}
        
      </div>
    </div>
  );
};