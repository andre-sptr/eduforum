import { useState } from "react";
import { ChevronLeft, ChevronRight, Play, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MediaCarouselProps {
  mediaUrls: string[];
  mediaTypes: string[];
}

const MediaCarousel = ({ mediaUrls, mediaTypes }: MediaCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!mediaUrls || mediaUrls.length === 0) return null;

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? mediaUrls.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === mediaUrls.length - 1 ? 0 : prev + 1));
  };

  const renderMedia = () => {
    const url = mediaUrls[currentIndex];
    const type = mediaTypes[currentIndex];

    switch (type) {
      case 'image':
        return (
          <img
            src={url}
            alt="Post media"
            className="w-full max-h-[500px] object-contain rounded-lg"
          />
        );
      case 'video':
        return (
          <video
            src={url}
            controls
            className="w-full max-h-[500px] rounded-lg"
          />
        );
      case 'audio':
        return (
          <div className="w-full bg-muted/50 rounded-lg p-8 flex items-center justify-center">
            <audio src={url} controls className="w-full max-w-md" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative mt-4 mb-2">
      {renderMedia()}

      {mediaUrls.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevious}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {mediaUrls.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? "bg-accent w-6"
                    : "bg-white/50 hover:bg-white/75"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default MediaCarousel;
