import { useState } from "react";
import { ChevronLeft, ChevronRight, Music, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MediaCarouselProps {
  mediaUrls: string[];
  mediaTypes: string[];
}

const MediaCarousel = ({ mediaUrls, mediaTypes }: MediaCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  if (!mediaUrls || mediaUrls.length === 0) return null;

  const goToPrevious = () => setCurrentIndex(p => (p === 0 ? mediaUrls.length - 1 : p - 1));
  const goToNext = () => setCurrentIndex(p => (p === mediaUrls.length - 1 ? 0 : p + 1));

  const renderMedia = () => {
    const url = mediaUrls[currentIndex];
    const type = mediaTypes[currentIndex];
    if (type === "image") return <img src={url} alt="" className="h-full w-full object-contain" />;
    if (type === "video") return (
      <div className="relative h-full w-full flex items-center justify-center">
        <video src={url} className="h-full w-full object-contain" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="p-4 bg-black/60 rounded-full text-white opacity-80 transition-all duration-300 group-hover:bg-black/70 group-hover:scale-110 group-hover:opacity-100">
            <Play className="h-10 w-10 fill-current" />
          </div>
        </div>
      </div>
    );
    if (type === "audio") return (
      <div className="relative h-full w-full flex items-center justify-center">
        <div className="flex items-center justify-center p-4 rounded-full bg-black/40 text-white opacity-80 transition-all duration-300 group-hover:bg-black/60 group-hover:scale-110 group-hover:opacity-100"><Music className="h-16 w-16" /></div>
      </div>
    );
    return null;
  };

  return (
    <div className="relative mt-3">
      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-black/5">
        <div className="h-[420px] w-full">{renderMedia()}</div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
        <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-1 text-xs text-white">{currentIndex + 1} / {mediaUrls.length}</div>
        {mediaUrls.length > 1 && (
          <>
            <Button aria-label="Sebelumnya" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); goToPrevious(); }} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button aria-label="Berikutnya" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); goToNext(); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60">
              <ChevronRight className="h-5 w-5" />
            </Button>
            <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 gap-1.5">
              {mediaUrls.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Ke media ${i + 1}`}
                  onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }}
                  className={`h-1.5 rounded-full transition-all ${i === currentIndex ? "w-6 bg-white" : "w-1.5 bg-white/60 hover:bg-white/80"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MediaCarousel;