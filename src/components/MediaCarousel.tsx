import { useState } from "react";
import { ChevronLeft, ChevronRight, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface MediaCarouselProps {
  mediaUrls: string[];
  mediaTypes: string[];
}

const MediaCarousel = ({ mediaUrls, mediaTypes }: MediaCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  if (!mediaUrls || mediaUrls.length === 0) return null;

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    setCurrentIndex((prev) => {
      let nextIndex = prev + newDirection;
      if (nextIndex < 0) nextIndex = mediaUrls.length - 1;
      if (nextIndex >= mediaUrls.length) nextIndex = 0;
      return nextIndex;
    });
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0
    })
  };

  return (
    <div className="relative mx-auto max-w-2xl overflow-hidden rounded-3xl bg-black shadow-2xl ring-1 ring-white/10 group">
      <div className="relative aspect-[4/5] sm:aspect-video w-full">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            className="absolute inset-0 h-full w-full flex items-center justify-center"
          >
            {mediaTypes[currentIndex] === "image" && (
              <img 
                src={mediaUrls[currentIndex]} 
                alt="" 
                className="h-full w-full object-contain" 
                loading="lazy"
                decoding="async"
              />
            )}
            {mediaTypes[currentIndex] === "video" && (
              <video 
                src={mediaUrls[currentIndex]} 
                controls 
                className="h-full w-full bg-black" 
                preload="metadata"
              />
            )}
            {mediaTypes[currentIndex] === "audio" && (
                <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-black p-8 text-white">
                    <div className="mb-6 rounded-full bg-white/5 p-8 ring-1 ring-white/10 backdrop-blur-md">
                        <Music className="h-16 w-16 text-primary animate-pulse" />
                    </div>
                    <audio src={mediaUrls[currentIndex]} controls className="w-full max-w-md [&::-webkit-media-controls-panel]:bg-white/10 [&::-webkit-media-controls-panel]:backdrop-blur-md" />
                </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {mediaUrls.length > 1 && (
        <>
          <div className="absolute inset-0 pointer-events-none flex items-center justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
             <Button 
                variant="ghost" 
                size="icon" 
                className="pointer-events-auto h-10 w-10 rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70 border border-white/10 transition-transform active:scale-95" 
                onClick={() => paginate(-1)}
             >
                <ChevronLeft className="h-6 w-6" />
             </Button>
             <Button 
                variant="ghost" 
                size="icon" 
                className="pointer-events-auto h-10 w-10 rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70 border border-white/10 transition-transform active:scale-95" 
                onClick={() => paginate(1)}
             >
                <ChevronRight className="h-6 w-6" />
             </Button>
          </div>
          
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-md border border-white/5 z-10">
            {mediaUrls.map((_, index) => (
              <button
                key={index}
                className={`h-1.5 rounded-full transition-all duration-300 ${index === currentIndex ? "w-6 bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "w-1.5 bg-white/30 hover:bg-white/50"}`}
                onClick={() => {
                  setDirection(index > currentIndex ? 1 : -1);
                  setCurrentIndex(index);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default MediaCarousel;